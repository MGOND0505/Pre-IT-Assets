import { env } from "./config/env";
import { connectDB, isDbConnected } from "./config/db";
import { app } from "./app";
import { logger } from "./utils/logger";
import { ensureMasterDataDefaults } from "./scripts/seedMasterDataDefaults";
import { startAlertScheduler } from "./services/alerts/scheduler";
import { startOrganizationExpiryScheduler } from "./services/organizations/expiryScheduler";
import { startRecycleBinScheduler } from "./services/organizations/recycleBinScheduler";
import { startDataRetentionScheduler } from "./services/recycleBin/dataRetentionScheduler";
import { startEscalationScheduler } from "./services/helpdesk/escalationScheduler";
import { startCacheCleanupScheduler } from "./services/maintenance/cacheCleanupScheduler";

async function start() {
  try {
    await connectDB();
    await ensureMasterDataDefaults();
    startAlertScheduler();
    startOrganizationExpiryScheduler();
    startRecycleBinScheduler();
    startDataRetentionScheduler();
    startEscalationScheduler();
    startCacheCleanupScheduler();
  } catch (err) {
    logger.error(`Startup error: ${err instanceof Error ? err.message : err}`);
  }

  if (!isDbConnected()) {
    logger.warn("Starting without a DB connection - master data defaults were not seeded");
  }

  // A non-fatal warning, not a hard refusal to start - some existing deployments are already
  // running with this unset and a startup crash would take down a working production instance
  // over a config value that's often fixed by an ops follow-up, not a code change. Still loud
  // enough that it shouldn't go unnoticed: a production deployment without COOKIE_SECURE=true
  // sends the session cookie over plain HTTP if anything in front of it (or misconfigured TLS
  // termination) ever allows a non-HTTPS path to reach this app.
  if (env.NODE_ENV === "production" && !env.COOKIE_SECURE) {
    logger.warn(
      "SECURITY WARNING: NODE_ENV=production but COOKIE_SECURE is not true - the session cookie " +
        "will be sent over plain HTTP. Set COOKIE_SECURE=true once this deployment is confirmed to " +
        "run entirely behind HTTPS."
    );
  }

  app.listen(env.PORT, () => {
    logger.info(`IT Asset backend listening on http://localhost:${env.PORT}`);
  });
}

start();
