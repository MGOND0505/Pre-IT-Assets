import { AuditLog } from "../../models/AuditLog";
import { User } from "../../models/User";

const ASSIGNMENT_ACTIONS = ["ASSIGN", "REASSIGN", "AUTO_ASSIGN", "ESCALATE"] as const;

export type TicketAssignmentHistoryEntry = {
  id: string;
  action: (typeof ASSIGNMENT_ACTIONS)[number];
  actorName: string;
  agentName: string;
  previousAgentName: string | null;
  tier: string | null;
  createdAt: Date;
};

/** Best-effort extraction of an agent reference out of an AuditLog row's Mixed
 * oldValue/newValue - these were written in a few different shapes over time (see
 * helpdesk.controller.ts, escalationScheduler.ts, and historical rows from the now-removed
 * Support Teams round-robin), so this reads whichever of the known key names is present rather
 * than assuming one fixed shape. */
function readRef(value: unknown, nameKey: string, idKey: string, legacyKey?: string): { id: string | null; name: string | null } {
  if (!value || typeof value !== "object") return { id: null, name: null };
  const obj = value as Record<string, unknown>;

  const directName = obj[nameKey];
  if (typeof directName === "string" && directName) return { id: typeof obj[idKey] === "string" ? (obj[idKey] as string) : null, name: directName };

  const directId = obj[idKey];
  if (typeof directId === "string" && directId) return { id: directId, name: null };

  const legacy = legacyKey ? obj[legacyKey] : undefined;
  if (legacy && typeof legacy === "object") {
    const legacyObj = legacy as Record<string, unknown>;
    const legacyName = legacyObj.name;
    if (typeof legacyName === "string" && legacyName) return { id: String(legacyObj._id ?? ""), name: legacyName };
    if (legacyObj._id) return { id: String(legacyObj._id), name: null };
  }
  if (typeof legacy === "string" && legacy) return { id: legacy, name: null };

  return { id: null, name: null };
}

export async function listTicketAssignmentHistory(ticketId: string, organizationId: string): Promise<TicketAssignmentHistoryEntry[]> {
  const rows = await AuditLog.find({
    organization: organizationId,
    module: "Ticket",
    recordId: ticketId,
    action: { $in: ASSIGNMENT_ACTIONS },
  }).sort({ createdAt: -1 });

  const pending = rows.map((row) => ({
    row,
    newAgent: readRef(row.newValue, "agentName", "agentId", "assignedAgent"),
    prevAgent: readRef(row.oldValue, "agentName", "agentId", row.action === "ESCALATE" ? "agent" : "assignedAgent"),
  }));

  const unresolvedIds = new Set<string>();
  for (const p of pending) {
    if (p.newAgent.id && !p.newAgent.name) unresolvedIds.add(p.newAgent.id);
    if (p.prevAgent.id && !p.prevAgent.name) unresolvedIds.add(p.prevAgent.id);
  }
  const resolvedUsers = unresolvedIds.size
    ? await User.find({ _id: { $in: Array.from(unresolvedIds) } }).select("name")
    : [];
  const nameById = new Map(resolvedUsers.map((u) => [String(u._id), u.name]));

  return pending.map(({ row, newAgent, prevAgent }) => {
    const tierRaw = (row.newValue as Record<string, unknown> | null)?.tier ?? (row.oldValue as Record<string, unknown> | null)?.tier;
    return {
      id: String(row._id),
      action: row.action as (typeof ASSIGNMENT_ACTIONS)[number],
      actorName: row.userSnapshot?.name ?? "System",
      agentName: newAgent.name ?? (newAgent.id ? nameById.get(newAgent.id) ?? "-" : "-"),
      previousAgentName: prevAgent.name ?? (prevAgent.id ? nameById.get(prevAgent.id) ?? null : null),
      tier: typeof tierRaw === "string" ? tierRaw : null,
      createdAt: row.createdAt,
    };
  });
}
