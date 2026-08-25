import cron from "node-cron";
import { runExpiryAlertCheck } from "./expiryAlerts";
import { logger } from "../../utils/logger";

/** Runs once a day at 08:00 server time. runExpiryAlertCheck no-ops on its own if alerts
 * are disabled or nothing is configured yet, so it's safe to always schedule this. */
export function startAlertScheduler(): void {
  cron.schedule("0 8 * * *", () => {
    runExpiryAlertCheck().catch((err) => {
      logger.error(`Expiry alert check failed: ${err instanceof Error ? err.message : err}`);
    });
  });
  logger.info("Expiry alert scheduler started (daily at 08:00)");
}
