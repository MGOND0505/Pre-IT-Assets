import { Ticket, TICKET_STATUSES, type ITicket, type TicketStatus } from "../../models/Ticket";
import { HelpdeskPriority } from "../../models/HelpdeskPriority";
import { User } from "../../models/User";
import { ApiError } from "../../utils/ApiError";
import { claimNextTicketSequence } from "../settings/settings.service";
import { autoAssignTicket } from "./roundRobin.service";
import { getOrgRetentionDays, withRecycleBinMeta } from "../../utils/recycleBin";

const POPULATE_FIELDS = [
  { path: "category", select: "name" },
  { path: "priority", select: "name color slaResponseMinutes slaResolutionMinutes" },
  { path: "requester", select: "name email" },
  { path: "department", select: "name" },
  { path: "location", select: "name" },
  { path: "assignedAgent", select: "name email" },
  { path: "assignedTeam", select: "name tier" },
];

async function generateTicketId(organizationId: string): Promise<string> {
  const { prefix, sequence } = await claimNextTicketSequence(organizationId);
  return `${prefix}-${String(sequence).padStart(6, "0")}`;
}

/** A caller can only see the whole org's queue if they can act on tickets beyond filing their
 * own (assign or update rights) - anyone with just view/create/comment only sees what they
 * requested. Derived from existing permission flags rather than a new "requester" role field. */
function canViewAllTickets(user: { isAdmin: boolean; permissions: { helpdesk: { assign: boolean; update: boolean } } }) {
  return user.isAdmin || user.permissions.helpdesk.assign || user.permissions.helpdesk.update;
}

type ListInput = {
  page?: number;
  limit?: number;
  search?: string;
  status?: TicketStatus;
  priority?: string;
  category?: string;
  assignedAgent?: string;
  includeDeleted?: boolean;
};

export async function listTickets(
  input: ListInput,
  organizationId: string,
  requestingUser: { id: string; isAdmin: boolean; permissions: { helpdesk: { assign: boolean; update: boolean } } }
) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = { organization: organizationId, isDeleted: input.includeDeleted ? true : false };
  if (!canViewAllTickets(requestingUser)) filter.requester = requestingUser.id;
  if (input.status) filter.status = input.status;
  if (input.priority) filter.priority = input.priority;
  if (input.category) filter.category = input.category;
  if (input.assignedAgent) filter.assignedAgent = input.assignedAgent;
  if (input.search) {
    filter.$or = [
      { ticketId: { $regex: input.search, $options: "i" } },
      { subject: { $regex: input.search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    Ticket.find(filter)
      .populate(POPULATE_FIELDS)
      .sort({ createdDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Ticket.countDocuments(filter),
  ]);

  const retentionDays = await getOrgRetentionDays(organizationId);
  return { items: withRecycleBinMeta(items, retentionDays), total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getTicketById(id: string, organizationId: string) {
  const ticket = await Ticket.findOne({ _id: id, organization: organizationId, isDeleted: false }).populate(POPULATE_FIELDS);
  if (!ticket) throw new ApiError(404, "Ticket not found");
  return ticket;
}

type CreateInput = {
  subject: string;
  description?: string;
  category?: string;
  priority: string;
  department?: string;
  location?: string;
};

export async function createTicket(input: CreateInput, organizationId: string, requesterId: string) {
  const priority = await HelpdeskPriority.findOne({ _id: input.priority, organization: organizationId });
  if (!priority) throw new ApiError(400, "Invalid priority");

  const requester = await User.findOne({ _id: requesterId, organization: organizationId });
  if (!requester) throw new ApiError(404, "Requester not found");

  const now = new Date();
  const department = input.department ?? (requester.department ? String(requester.department) : undefined);
  const location = input.location ?? (requester.location ? String(requester.location) : undefined);

  for (let attempt = 0; attempt < 3; attempt++) {
    const ticketId = await generateTicketId(organizationId);
    try {
      const ticket = await Ticket.create({
        organization: organizationId,
        ticketId,
        subject: input.subject,
        description: input.description ?? "",
        category: input.category ?? null,
        priority: priority._id,
        requester: requesterId,
        department: department ?? null,
        location: location ?? null,
        tier: "L1",
        status: "New",
        slaResponseDueAt: new Date(now.getTime() + priority.slaResponseMinutes * 60 * 1000),
        slaResolutionDueAt: new Date(now.getTime() + priority.slaResolutionMinutes * 60 * 1000),
        createdBy: requesterId,
      });

      await autoAssignTicket(ticket);
      await ticket.save();

      return getTicketById(ticket.id, organizationId);
    } catch (err) {
      const isDuplicateKey = (err as { code?: number })?.code === 11000;
      if (!isDuplicateKey || attempt === 2) throw err;
    }
  }
  throw new ApiError(500, "Could not generate a unique ticket ID, please try again");
}

type UpdateInput = Partial<{
  subject: string;
  description: string;
  category: string;
  priority: string;
  department: string;
  location: string;
}>;

export async function updateTicket(id: string, input: UpdateInput, organizationId: string) {
  const ticket = await getTicketById(id, organizationId);
  Object.assign(ticket, input);
  await ticket.save();
  return getTicketById(id, organizationId);
}

const TERMINAL_STATUSES: TicketStatus[] = ["Resolved", "Closed"];

export async function setTicketStatus(id: string, status: TicketStatus, resolution: string | undefined, organizationId: string) {
  if (!TICKET_STATUSES.includes(status)) throw new ApiError(400, "Invalid ticket status");
  const ticket = await getTicketById(id, organizationId);

  ticket.status = status;
  if (resolution !== undefined) ticket.resolution = resolution;

  if (status === "Resolved") ticket.resolvedAt = new Date();
  if (status === "Closed") ticket.closedAt = new Date();
  if (status === "Reopened") {
    ticket.reopenCount += 1;
    ticket.resolvedAt = null;
    ticket.closedAt = null;
    // A reopened ticket is live again - clear any prior breach so it gets a fresh SLA read on
    // the next escalation run rather than being immediately re-escalated for old history.
    ticket.slaResolutionBreached = false;
    ticket.slaWarningSent = false;
  }

  await ticket.save();
  return getTicketById(id, organizationId);
}

export async function assignTicket(id: string, agentId: string, organizationId: string) {
  const ticket = await getTicketById(id, organizationId);
  const agent = await User.findOne({ _id: agentId, organization: organizationId });
  if (!agent) throw new ApiError(404, "Agent not found");

  ticket.assignedAgent = agent._id as never;
  await ticket.save();
  return getTicketById(id, organizationId);
}

export async function deleteTicket(id: string, deletedBy: string, organizationId: string) {
  const ticket = await getTicketById(id, organizationId);
  ticket.isDeleted = true;
  ticket.deletedAt = new Date();
  ticket.deletedBy = deletedBy as unknown as ITicket["deletedBy"];
  await ticket.save();
  return ticket;
}

export async function restoreTicket(id: string, organizationId: string) {
  const ticket = await Ticket.findOne({ _id: id, organization: organizationId, isDeleted: true });
  if (!ticket) throw new ApiError(404, "Deleted ticket not found");

  ticket.isDeleted = false;
  ticket.deletedAt = null;
  ticket.deletedBy = null;
  await ticket.save();
  return getTicketById(id, organizationId);
}

export async function getHelpdeskStats(organizationId: string) {
  const base = { organization: organizationId, isDeleted: false };
  const now = new Date();

  const [total, byStatusRaw, slaBreached, byPriorityRaw, byCategoryRaw, byDepartmentRaw, byAgentRaw, timings] = await Promise.all([
    Ticket.countDocuments(base),
    Ticket.aggregate([{ $match: base }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Ticket.countDocuments({
      ...base,
      status: { $nin: TERMINAL_STATUSES },
      slaResolutionDueAt: { $ne: null, $lt: now },
    }),
    Ticket.aggregate([{ $match: base }, { $group: { _id: "$priority", count: { $sum: 1 } } }]),
    Ticket.aggregate([{ $match: base }, { $group: { _id: "$category", count: { $sum: 1 } } }]),
    Ticket.aggregate([{ $match: base }, { $group: { _id: "$department", count: { $sum: 1 } } }]),
    Ticket.aggregate([{ $match: base }, { $group: { _id: "$assignedAgent", count: { $sum: 1 } } }]),
    Ticket.aggregate([
      { $match: { ...base, firstResponseAt: { $ne: null } } },
      {
        $group: {
          _id: null,
          avgResponseMs: { $avg: { $subtract: ["$firstResponseAt", "$createdDate"] } },
        },
      },
    ]),
  ]);

  const resolutionTimings = await Ticket.aggregate([
    { $match: { ...base, resolvedAt: { $ne: null } } },
    { $group: { _id: null, avgResolutionMs: { $avg: { $subtract: ["$resolvedAt", "$createdDate"] } } } },
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of byStatusRaw) byStatus[row._id ?? "Unknown"] = row.count;

  return {
    total,
    byStatus,
    slaBreached,
    byPriority: byPriorityRaw,
    byCategory: byCategoryRaw,
    byDepartment: byDepartmentRaw,
    byAgent: byAgentRaw,
    avgResponseMinutes: timings[0] ? Math.round(timings[0].avgResponseMs / 60000) : null,
    avgResolutionMinutes: resolutionTimings[0] ? Math.round(resolutionTimings[0].avgResolutionMs / 60000) : null,
  };
}
