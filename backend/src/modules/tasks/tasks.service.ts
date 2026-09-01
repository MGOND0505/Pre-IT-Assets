import { Types } from "mongoose";
import { Task, TASK_STATUSES, type ITask, type TaskStatus } from "../../models/Task";
import { Ticket } from "../../models/Ticket";
import { User } from "../../models/User";
import { ApiError } from "../../utils/ApiError";
import { claimNextTaskSequence } from "../settings/settings.service";
import { getOrgRetentionDays, withRecycleBinMeta } from "../../utils/recycleBin";
import { escapeRegex } from "../../utils/regex";

const POPULATE_FIELDS = [
  { path: "assignedTo", select: "name email" },
  { path: "assignedBy", select: "name email" },
  { path: "ticket", select: "ticketId subject" },
];

async function generateTaskId(organizationId: string): Promise<string> {
  const { prefix, sequence } = await claimNextTaskSequence(organizationId);
  return `${prefix}-${String(sequence).padStart(6, "0")}`;
}

/** Same visibility rule as Helpdesk tickets: only a caller who can assign work to OTHERS sees
 * the whole org's task list - everyone else sees just what's assigned to them or that they
 * created. */
export function canViewAllTasks(user: { isAdmin: boolean; permissions: { tasks: { assign: boolean } } }) {
  return user.isAdmin || user.permissions.tasks.assign;
}

type RequestingUser = { id: string; isAdmin: boolean; permissions: { tasks: { assign: boolean } } };

type ListInput = {
  page?: number;
  limit?: number;
  search?: string;
  status?: TaskStatus;
  priority?: string;
  assignedTo?: string;
  ticket?: string;
  includeDeleted?: boolean;
};

export async function listTasks(
  input: ListInput,
  organizationId: string,
  requestingUser: { id: string; isAdmin: boolean; permissions: { tasks: { assign: boolean } } }
) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = { organization: organizationId, isDeleted: input.includeDeleted ? true : false };
  if (input.ticket) {
    filter.ticket = input.ticket;
  } else {
    // The standalone Tasks module never shows ticket sub-tasks mixed into the general list -
    // those live only under their ticket's own detail page.
    filter.ticket = null;
    if (!canViewAllTasks(requestingUser)) {
      filter.$or = [{ assignedTo: requestingUser.id }, { createdBy: requestingUser.id }];
    }
  }
  if (input.status) filter.status = input.status;
  if (input.priority) filter.priority = input.priority;
  if (input.assignedTo) filter.assignedTo = input.assignedTo;
  if (input.search) filter.title = { $regex: escapeRegex(input.search), $options: "i" };

  const [items, total] = await Promise.all([
    Task.find(filter)
      .populate(POPULATE_FIELDS)
      .sort({ createdDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Task.countDocuments(filter),
  ]);

  const retentionDays = await getOrgRetentionDays(organizationId);
  return { items: withRecycleBinMeta(items, retentionDays), total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function listSubtasksForTicket(ticketId: string, organizationId: string) {
  return Task.find({ organization: organizationId, ticket: ticketId, isDeleted: false })
    .populate(POPULATE_FIELDS)
    .sort({ createdDate: 1 });
}

export async function getTaskById(id: string, organizationId: string) {
  const task = await Task.findOne({ _id: id, organization: organizationId, isDeleted: false }).populate(POPULATE_FIELDS);
  if (!task) throw new ApiError(404, "Task not found");
  return task;
}

/** The view-facing variant of getTaskById - used by every read route that operates on a specific
 * task id (detail, comments). A caller who can't see the whole task list gets a 404 for a task
 * that isn't assigned to (or created by) them, same as `listTasks`' filter - never a 403, so an
 * unauthorized caller can't tell a real id from a made-up one. Internal write-flow lookups
 * (update/status-change/assign/delete/restore) intentionally keep using the plain getTaskById
 * above - their own route-level permission is the real authorization for those. Mirrors
 * helpdesk.service.ts#getTicketByIdForRequester / assets.service.ts#getAssetByIdForRequester. */
export async function getTaskByIdForRequester(id: string, organizationId: string, requestingUser: RequestingUser) {
  const task = await getTaskById(id, organizationId);
  if (!canViewAllTasks(requestingUser)) {
    const assignedTo = task.assignedTo as unknown as { _id?: unknown } | null;
    const assignedToId = assignedTo ? String(assignedTo._id ?? assignedTo) : null;
    const createdBy = task.createdBy as unknown as { _id?: unknown } | null;
    const createdById = createdBy ? String(createdBy._id ?? createdBy) : null;
    if (assignedToId !== requestingUser.id && createdById !== requestingUser.id) {
      throw new ApiError(404, "Task not found");
    }
  }
  return task;
}

type CreateInput = {
  title: string;
  description?: string;
  assignedTo: string;
  dueDate?: string;
  priority?: ITask["priority"];
  ticket?: string;
};

export async function createTask(input: CreateInput, organizationId: string, createdBy: string) {
  const assignee = await User.findOne({ _id: input.assignedTo, organization: organizationId });
  if (!assignee) throw new ApiError(404, "Assignee not found");

  if (input.ticket) {
    const ticket = await Ticket.findOne({ _id: input.ticket, organization: organizationId, isDeleted: false });
    if (!ticket) throw new ApiError(404, "Ticket not found");
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    const taskId = await generateTaskId(organizationId);
    try {
      const task = await Task.create({
        organization: organizationId,
        taskId,
        title: input.title,
        description: input.description ?? "",
        assignedTo: input.assignedTo,
        assignedBy: createdBy,
        dueDate: input.dueDate ?? null,
        priority: input.priority ?? "Medium",
        ticket: input.ticket ?? null,
        createdBy,
      });
      return getTaskById(task.id, organizationId);
    } catch (err) {
      const isDuplicateKey = (err as { code?: number })?.code === 11000;
      if (!isDuplicateKey || attempt === 2) throw err;
    }
  }
  throw new ApiError(500, "Could not generate a unique task ID, please try again");
}

type UpdateInput = Partial<{
  title: string;
  description: string;
  dueDate: string | null;
  priority: ITask["priority"];
}>;

export async function updateTask(id: string, input: UpdateInput, organizationId: string) {
  const task = await getTaskById(id, organizationId);
  Object.assign(task, input);
  await task.save();
  return getTaskById(id, organizationId);
}

export async function setTaskStatus(id: string, status: TaskStatus, organizationId: string) {
  if (!TASK_STATUSES.includes(status)) throw new ApiError(400, "Invalid task status");
  const task = await getTaskById(id, organizationId);

  task.status = status;
  task.completedAt = status === "Done" ? new Date() : null;
  // A task that comes back to life (reopened from Done/Cancelled) deserves a fresh overdue
  // read rather than being silently skipped forever because a notice already went out once.
  if (status === "To Do" || status === "In Progress") task.overdueNoticeSent = false;

  await task.save();
  return getTaskById(id, organizationId);
}

export async function assignTask(id: string, assigneeId: string, organizationId: string) {
  const task = await getTaskById(id, organizationId);
  const assignee = await User.findOne({ _id: assigneeId, organization: organizationId });
  if (!assignee) throw new ApiError(404, "Assignee not found");

  task.assignedTo = assignee._id as never;
  await task.save();
  return getTaskById(id, organizationId);
}

export async function deleteTask(id: string, deletedBy: string, organizationId: string) {
  const task = await getTaskById(id, organizationId);
  task.isDeleted = true;
  task.deletedAt = new Date();
  task.deletedBy = deletedBy as unknown as ITask["deletedBy"];
  await task.save();
  return task;
}

export async function restoreTask(id: string, organizationId: string) {
  const task = await Task.findOne({ _id: id, organization: organizationId, isDeleted: true });
  if (!task) throw new ApiError(404, "Deleted task not found");

  task.isDeleted = false;
  task.deletedAt = null;
  task.deletedBy = null;
  await task.save();
  return getTaskById(id, organizationId);
}

/** Always scoped to exactly one user's own tasks (assigned to them OR created by them - same
 * "mine" definition listTasks/canViewAllTasks already use), regardless of view-all permission -
 * powers the Employee Portal's "My Tasks" widget. There's no org-wide task stats endpoint to
 * mirror (the admin dashboard doesn't show one today), so this is net new rather than a
 * "my" variant of an existing stats function. */
export async function getMyTaskSummary(organizationId: string, userId: string) {
  const orgId = new Types.ObjectId(organizationId);
  const uid = new Types.ObjectId(userId);
  const filter = {
    organization: orgId,
    isDeleted: false,
    $or: [{ assignedTo: uid }, { createdBy: uid }],
  };

  const [total, pending, byStatusRaw] = await Promise.all([
    Task.countDocuments(filter),
    Task.countDocuments({ ...filter, status: { $nin: ["Done", "Cancelled"] } }),
    Task.aggregate([{ $match: filter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of byStatusRaw as { _id: string; count: number }[]) byStatus[row._id] = row.count;

  return { total, pending, byStatus };
}
