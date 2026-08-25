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

async function start() {
  try {
    await connectDB();
    await ensureMasterDataDefaults();
    startAlertScheduler();
    startOrganizationExpiryScheduler();
    startRecycleBinScheduler();
    startDataRetentionScheduler();
    startEscalationScheduler();
  } catch (err) {
    logger.error(`Startup error: ${err instanceof Error ? err.message : err}`);
  }

  if (!isDbConnected()) {
    logger.warn("Starting without a DB connection - master data defaults were not seeded");
  }

  app.listen(env.PORT, () => {
    logger.info(`IT Asset backend listening on http://localhost:${env.PORT}`);
  });
}

start();
