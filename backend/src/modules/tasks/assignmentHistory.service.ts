import { AuditLog } from "../../models/AuditLog";
import { User } from "../../models/User";

/** Mirrors modules/helpdesk/assignmentHistory.service.ts exactly - Task has no dedicated history
 * model either, "Assignment History" is reconstructed on the fly from the AuditLog rows
 * tasks.controller.ts already writes for CREATE (the initial assignment) and ASSIGN
 * (every reassignment) - see tasks.service.ts#createTask/#assignTask. */
const ASSIGNMENT_ACTIONS = ["CREATE", "ASSIGN"] as const;

export type TaskAssignmentHistoryEntry = {
  id: string;
  action: (typeof ASSIGNMENT_ACTIONS)[number];
  actorName: string;
  assigneeName: string;
  previousAssigneeName: string | null;
  reason: string | null;
  createdAt: Date;
};

/** `assignedTo` on a Task AuditLog row's Mixed oldValue/newValue is either a raw id string
 * (req.body.assignedTo/assigneeId, written verbatim) or a populated User sub-document (`before`
 * in tasks.controller.ts#assignTask comes from a populated getTaskById) - read whichever shape is
 * present rather than assuming one. */
function readAssignedTo(value: unknown): { id: string | null; name: string | null } {
  if (!value || typeof value !== "object") return { id: null, name: null };
  const assignedTo = (value as Record<string, unknown>).assignedTo;
  if (!assignedTo) return { id: null, name: null };
  if (typeof assignedTo === "string") return { id: assignedTo, name: null };
  if (typeof assignedTo === "object") {
    const ref = assignedTo as Record<string, unknown>;
    const name = typeof ref.name === "string" ? ref.name : null;
    const id = ref._id ? String(ref._id) : null;
    return { id, name };
  }
  return { id: null, name: null };
}

export async function listTaskAssignmentHistory(taskId: string, organizationId: string): Promise<TaskAssignmentHistoryEntry[]> {
  const rows = await AuditLog.find({
    organization: organizationId,
    module: "Task",
    recordId: taskId,
    action: { $in: ASSIGNMENT_ACTIONS },
  }).sort({ createdAt: -1 });

  const pending = rows.map((row) => ({
    row,
    newAssignee: readAssignedTo(row.newValue),
    prevAssignee: readAssignedTo(row.oldValue),
  }));

  const unresolvedIds = new Set<string>();
  for (const p of pending) {
    if (p.newAssignee.id && !p.newAssignee.name) unresolvedIds.add(p.newAssignee.id);
    if (p.prevAssignee.id && !p.prevAssignee.name) unresolvedIds.add(p.prevAssignee.id);
  }
  const resolvedUsers = unresolvedIds.size ? await User.find({ _id: { $in: Array.from(unresolvedIds) } }).select("name") : [];
  const nameById = new Map(resolvedUsers.map((u) => [String(u._id), u.name]));

  return pending.map(({ row, newAssignee, prevAssignee }) => {
    const reasonRaw = (row.newValue as Record<string, unknown> | null)?.reason;
    return {
      id: String(row._id),
      action: row.action as (typeof ASSIGNMENT_ACTIONS)[number],
      actorName: row.userSnapshot?.name ?? "System",
      assigneeName: newAssignee.name ?? (newAssignee.id ? (nameById.get(newAssignee.id) ?? "-") : "-"),
      previousAssigneeName: prevAssignee.name ?? (prevAssignee.id ? (nameById.get(prevAssignee.id) ?? null) : null),
      reason: typeof reasonRaw === "string" && reasonRaw ? reasonRaw : null,
      createdAt: row.createdAt,
    };
  });
}
