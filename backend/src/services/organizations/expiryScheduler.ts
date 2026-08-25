import cron from "node-cron";
import { Organization } from "../../models/Organization";
import { User } from "../../models/User";
import { AuditLog } from "../../models/AuditLog";
import { getSubscriptionState } from "../../modules/organizations/organizations.service";
import { logger } from "../../utils/logger";

/**
 * Enforcement of an expired subscription is already real-time (getSubscriptionState is computed
 * fresh on every login/resolveOrganization call, never read off a possibly-stale persisted
 * field) - this sweep does NOT gate access. It exists purely to (a) keep the persisted `status`
 * field truthful for anything that reads it directly (the Organizations list/detail views, or
 * a future export), and (b) revoke any already-issued session for that org's users the moment
 * it tips into Suspended, by bumping tokenVersion - the same mechanism authenticate.ts already
 * checks on every request for password-reset/change-password invalidation.
 */
export async function sweepExpiredOrganizations(): Promise<void> {
  const candidates = await Organization.find({ status: "Active", validUntil: { $ne: null }, isDeleted: false });

  for (const org of candidates) {
    if (getSubscriptionState(org) !== "Suspended") continue;

    org.status = "Inactive";
    await org.save();

    await User.updateMany({ organization: org._id }, { $inc: { tokenVersion: 1 } });

    await AuditLog.create({
      organization: org._id,
      user: null,
      userSnapshot: { name: "System", email: null, role: null },
      action: "AUTO_SUSPEND",
      module: "Organization",
      recordId: org.id,
      recordLabel: org.name,
      newValue: { status: "Inactive", validUntil: org.validUntil },
    });

    logger.info(`Organization "${org.name}" (${org.slug}) auto-suspended - subscription expired past grace period`);
  }
}

/** Runs once a day at 08:00 server time, alongside the expiry alert scheduler. */
export function startOrganizationExpiryScheduler(): void {
  cron.schedule("0 8 * * *", () => {
    sweepExpiredOrganizations().catch((err) => {
      logger.error(`Organization expiry sweep failed: ${err instanceof Error ? err.message : err}`);
    });
  });
  logger.info("Organization expiry scheduler started (daily at 08:00)");
}
