import cron from "node-cron";
import { Organization } from "../../models/Organization";
import { ORG_RECYCLE_BIN_RETENTION_DAYS, DAY_MS } from "../../modules/organizations/organizations.service";
import { purgeOrganization } from "./purgeOrganization";
import { logger } from "../../utils/logger";
import { recordSchedulerRun, SCHEDULER_KEYS } from "../monitoring/schedulerRun.service";

/** Finds every deleted organization whose 90-day Recycle Bin window has elapsed and permanently
 * purges it (org + every record scoped to it). Each organization is purged independently so one
 * failure doesn't block the rest of the sweep. */
export async function sweepExpiredDeletedOrganizations(): Promise<number> {
  const cutoff = new Date(Date.now() - ORG_RECYCLE_BIN_RETENTION_DAYS * DAY_MS);
  const candidates = await Organization.find({ isDeleted: true, deletedAt: { $ne: null, $lte: cutoff } }).select(
    "_id name slug"
  );

  let purged = 0;
  for (const org of candidates) {
    try {
      await purgeOrganization(String(org._id));
      purged += 1;
    } catch (err) {
      logger.error(`Auto-purge failed for organization "${org.name}" (${org.slug}): ${err instanceof Error ? err.message : err}`);
    }
  }
  return purged;
}

/** Runs once a day at 08:30 server time - slightly offset from the other 08:00 daily jobs
 * (expiry sweep, expiry alerts) so they don't all hit the DB in the same instant. */
export function startRecycleBinScheduler(): void {
  cron.schedule("30 8 * * *", () => {
    sweepExpiredDeletedOrganizations()
      .then((count) => recordSchedulerRun(SCHEDULER_KEYS.recycleBinPurge, { success: true, itemCount: count, errorMessage: null }))
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Recycle Bin purge sweep failed: ${message}`);
        recordSchedulerRun(SCHEDULER_KEYS.recycleBinPurge, { success: false, itemCount: 0, errorMessage: message }).catch(() => {});
      });
  });
  logger.info("Recycle Bin purge scheduler started (daily at 08:30)");
}
