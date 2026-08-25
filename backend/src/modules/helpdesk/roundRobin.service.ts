import { SupportTeam, type SupportTier } from "../../models/SupportTeam";
import { AuditLog } from "../../models/AuditLog";
import { logger } from "../../utils/logger";
import type { ITicket } from "../../models/Ticket";

type EligibilityInput = {
  organizationId: string;
  tier: SupportTier;
  categoryId: string | null;
  departmentId: string | null;
  locationId: string | null;
};

/** First Active team for this tier where categories/departments/locations either is empty
 * (matches anything) or includes the ticket's value. Teams are tried in creation order - an org
 * with multiple equally-eligible teams for the same tier should scope them (by category, etc.)
 * to avoid ambiguity rather than relying on ordering, but ordering keeps this deterministic
 * either way. */
export async function findEligibleTeam(input: EligibilityInput) {
  const teams = await SupportTeam.find({ organization: input.organizationId, tier: input.tier, status: "Active" }).sort({
    createdDate: 1,
  });

  return (
    teams.find((team) => {
      const categoryOk = team.categories.length === 0 || (input.categoryId && team.categories.some((c) => String(c) === input.categoryId));
      const departmentOk =
        team.departments.length === 0 || (input.departmentId && team.departments.some((d) => String(d) === input.departmentId));
      const locationOk =
        team.locations.length === 0 || (input.locationId && team.locations.some((l) => String(l) === input.locationId));
      return categoryOk && departmentOk && locationOk;
    }) ?? null
  );
}

/** Rotates through the team's ACTIVE members only, atomically bumping the cursor. Best-effort
 * atomic (see plan's scope note on round-robin cursor advancement) - not a DB transaction. */
export async function pickNextAgent(team: InstanceType<typeof SupportTeam>) {
  const activeMembers = team.members.filter((m) => m.isActive);
  if (activeMembers.length === 0) return null;

  const index = team.roundRobinCursor % activeMembers.length;
  const agent = activeMembers[index].user;

  await SupportTeam.updateOne({ _id: team._id }, { $inc: { roundRobinCursor: 1 } });

  return agent;
}

/**
 * Auto-assigns a ticket to the next eligible agent for its (tier, category, department,
 * location). Never throws - a ticket with no eligible team/agent just stays unassigned, since
 * this must not block ticket creation or escalation.
 */
export async function autoAssignTicket(ticket: ITicket & { _id: unknown }) {
  try {
    const team = await findEligibleTeam({
      organizationId: String(ticket.organization),
      tier: ticket.tier,
      categoryId: ticket.category ? String(ticket.category) : null,
      departmentId: ticket.department ? String(ticket.department) : null,
      locationId: ticket.location ? String(ticket.location) : null,
    });
    if (!team) return null;

    const agent = await pickNextAgent(team);
    if (!agent) return null;

    ticket.assignedAgent = agent;
    ticket.assignedTeam = team._id as never;

    await AuditLog.create({
      organization: ticket.organization,
      user: null,
      userSnapshot: { name: "System", email: null, role: null },
      action: "AUTO_ASSIGN",
      module: "Ticket",
      recordId: String(ticket._id),
      recordLabel: ticket.ticketId,
      newValue: { assignedAgent: agent, team: team.name, tier: ticket.tier },
    });

    return { agent, team };
  } catch (err) {
    logger.error(`Round-robin auto-assign failed for ticket ${ticket.ticketId}: ${err instanceof Error ? err.message : err}`);
    return null;
  }
}
