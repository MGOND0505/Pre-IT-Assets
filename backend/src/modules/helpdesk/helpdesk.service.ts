import { Ticket, TICKET_STATUSES, type ITicket, type TicketStatus } from "../../models/Ticket";
import { HelpdeskPriority } from "../../models/HelpdeskPriority";
import { HelpdeskCategory } from "../../models/HelpdeskCategory";
import { User } from "../../models/User";
import { ApiError } from "../../utils/ApiError";
import { claimNextTicketSequence } from "../settings/settings.service";
import { getOrgRetentionDays, withRecycleBinMeta } from "../../utils/recycleBin";
import { escapeRegex } from "../../utils/regex";

const AVAILABLE_AGENT_FILTER = { status: "Active" as const, isDeleted: false, isOnLeave: { $ne: true } };

type AutoAssignResult = { agentId: string; autoForwarded: boolean };

/** Resolves who a brand-new ticket should auto-assign to, based on its category's configured
 * `defaultAgent` - falling back to that agent's own `backupAgent` if they're currently on leave.
 * Never throws; a category with no default agent, or where neither the agent nor their backup is
 * available, just returns null and the ticket is created unassigned. This is the one place
 * category-based auto-assignment happens - there is no team/rotation involved (see
 * HelpdeskCategory.ts's `defaultAgent` doc comment). */
async function resolveAutoAssignee(categoryId: string | null | undefined, organizationId: string): Promise<AutoAssignResult | null> {
  if (!categoryId) return null;

  const category = await HelpdeskCategory.findOne({ _id: categoryId, organization: organizationId }).select("defaultAgent");
  if (!category?.defaultAgent) return null;

  const isAvailable = (userId: unknown) =>
    User.exists({ _id: userId, organization: organizationId, ...AVAILABLE_AGENT_FILTER });

  if (await isAvailable(category.defaultAgent)) {
    return { agentId: String(category.defaultAgent), autoForwarded: false };
  }

  const defaultAgent = await User.findById(category.defaultAgent).select("backupAgent");
  if (defaultAgent?.backupAgent && (await isAvailable(defaultAgent.backupAgent))) {
    return { agentId: String(defaultAgent.backupAgent), autoForwarded: true };
  }

  return null;
}

const POPULATE_FIELDS = [
  { path: "category", select: "name" },
  { path: "priority", select: "name color slaResponseMinutes slaResolutionMinutes" },
  { path: "requester", select: "name email" },
  { path: "department", select: "name" },
  { path: "location", select: "name" },
  { path: "assignedAgent", select: "name email" },
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
    const search = escapeRegex(input.search);
    filter.$or = [
      { ticketId: { $regex: search, $options: "i" } },
      { subject: { $regex: search, $options: "i" } },
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

      const autoAssign = await resolveAutoAssignee(input.category, organizationId);
      if (autoAssign) {
        ticket.assignedAgent = autoAssign.agentId as never;
        if (autoAssign.autoForwarded) ticket.status = "Auto-Forwarded";
        await ticket.save();
      }

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

export const TERMINAL_STATUSES: TicketStatus[] = ["Resolved", "Closed"];

/** How long after being closed a ticket may still be reopened - past this window the requester
 * must file a new ticket instead. See helpdesk.controller.ts#setTicketStatus. */
export const REOPEN_WINDOW_HOURS = 36;

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
  const agent = await User.findOne({
    _id: agentId,
    organization: organizationId,
    status: "Active",
    isDeleted: false,
    isOnLeave: { $ne: true },
  });
  if (!agent) throw new ApiError(404, "Agent not found or not available");

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

const DASHBOARD_DAY_MS = 24 * 60 * 60 * 1000;

function dashboardLastNDays(now: Date, days: number): string[] {
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i--) result.push(new Date(now.getTime() - i * DASHBOARD_DAY_MS).toISOString().slice(0, 10));
  return result;
}

/**
 * The org-scoped dashboard's ticket widgets (donut, trend, top categories, insights, alerts) -
 * the exact same shape and computation as the Super Admin platform-wide dashboard
 * (organizations.service.ts#getSuperAdminDashboardStats), just filtered to one organization
 * instead of aggregating across all of them. Every number is real; nothing here is invented.
 */
export async function getHelpdeskDashboardSummary(organizationId: string, days = 7) {
  const base = { organization: organizationId, isDeleted: false };
  const now = new Date();
  const periodAgo = new Date(now.getTime() - days * DASHBOARD_DAY_MS);
  const priorPeriodAgo = new Date(now.getTime() - 2 * days * DASHBOARD_DAY_MS);

  const [
    open,
    newInPeriod,
    byStatusRaw,
    slaBreaches,
    topCategoriesRaw,
    trendRaw,
    ticketsInPriorPeriod,
    breachedTicketsRaw,
    topCategoryInPeriodRaw,
  ] = await Promise.all([
    Ticket.countDocuments({ ...base, status: { $nin: TERMINAL_STATUSES } }),
    Ticket.countDocuments({ ...base, createdDate: { $gte: periodAgo } }),
    Ticket.aggregate([{ $match: base }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Ticket.countDocuments({
      ...base,
      status: { $nin: TERMINAL_STATUSES },
      slaResolutionDueAt: { $ne: null, $lt: now },
    }),
    Ticket.aggregate([
      { $match: { ...base, category: { $ne: null } } },
      { $lookup: { from: "helpdeskcategories", localField: "category", foreignField: "_id", as: "cat" } },
      { $unwind: "$cat" },
      { $group: { _id: "$cat.name", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    Ticket.aggregate([
      { $match: { ...base, createdDate: { $gte: periodAgo } } },
      {
        $project: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$createdDate" } },
          bucket: {
            $switch: {
              branches: [
                { case: { $eq: ["$status", "Resolved"] }, then: "resolved" },
                { case: { $eq: ["$status", "Closed"] }, then: "closed" },
              ],
              default: "open",
            },
          },
        },
      },
      { $group: { _id: { day: "$day", bucket: "$bucket" }, count: { $sum: 1 } } },
    ]),
    Ticket.countDocuments({ ...base, createdDate: { $gte: priorPeriodAgo, $lt: periodAgo } }),
    Ticket.find({
      ...base,
      status: { $nin: TERMINAL_STATUSES },
      slaResolutionDueAt: { $ne: null, $lt: now },
    })
      .select("ticketId subject slaResolutionDueAt")
      .sort({ slaResolutionDueAt: 1 })
      .limit(5),
    Ticket.aggregate([
      { $match: { ...base, category: { $ne: null }, createdDate: { $gte: periodAgo } } },
      { $lookup: { from: "helpdeskcategories", localField: "category", foreignField: "_id", as: "cat" } },
      { $unwind: "$cat" },
      { $group: { _id: "$cat.name", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of byStatusRaw as { _id: string | null; count: number }[]) {
    byStatus[row._id ?? "Unknown"] = row.count;
  }

  const trendByDay = new Map<string, { open: number; resolved: number; closed: number }>();
  for (const day of dashboardLastNDays(now, days)) trendByDay.set(day, { open: 0, resolved: 0, closed: 0 });
  for (const row of trendRaw as { _id: { day: string; bucket: "open" | "resolved" | "closed" }; count: number }[]) {
    const bucket = trendByDay.get(row._id.day);
    if (bucket) bucket[row._id.bucket] = row.count;
  }

  return {
    open,
    newInPeriod,
    byStatus,
    slaBreaches,
    topCategories: (topCategoriesRaw as { _id: string; count: number }[]).map((r) => ({ name: r._id, count: r.count })),
    trend: Array.from(trendByDay.entries()).map(([date, counts]) => ({ date, ...counts })),
    insights: {
      days,
      ticketVolumeChangePct:
        ticketsInPriorPeriod > 0 ? Math.round(((newInPeriod - ticketsInPriorPeriod) / ticketsInPriorPeriod) * 100) : null,
      ticketsInPeriod: newInPeriod,
      ticketsInPriorPeriod,
      topCategoryInPeriod: (topCategoryInPeriodRaw as { _id: string; count: number }[])[0]?._id ?? null,
    },
    alerts: (breachedTicketsRaw as { _id: unknown; ticketId: string; subject: string; slaResolutionDueAt: Date }[]).map(
      (t) => ({ id: String(t._id), ticketId: t.ticketId, subject: t.subject, slaResolutionDueAt: t.slaResolutionDueAt })
    ),
  };
}
