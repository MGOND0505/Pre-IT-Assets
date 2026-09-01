import cron from "node-cron";
import { runExpiryAlertCheck } from "./expiryAlerts";
import { logger } from "../../utils/logger";
import { recordSchedulerRun, SCHEDULER_KEYS } from "../monitoring/schedulerRun.service";

/** Runs once a day at 08:00 server time. runExpiryAlertCheck no-ops on its own if alerts
 * are disabled or nothing is configured yet, so it's safe to always schedule this. */
export function startAlertScheduler(): void {
  cron.schedule("0 8 * * *", () => {
    runExpiryAlertCheck()
      .then((count) => recordSchedulerRun(SCHEDULER_KEYS.expiryAlerts, { success: true, itemCount: count, errorMessage: null }))
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Expiry alert check failed: ${message}`);
        recordSchedulerRun(SCHEDULER_KEYS.expiryAlerts, { success: false, itemCount: 0, errorMessage: message }).catch(() => {});
      });
  });
  logger.info("Expiry alert scheduler started (daily at 08:00)");
}
