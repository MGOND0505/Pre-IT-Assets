import { env } from "./config/env";
import { connectDB, isDbConnected } from "./config/db";
import { app } from "./app";
import { logger } from "./utils/logger";
import { ensureRbacDefaults } from "./scripts/seedRbacDefaults";
import { ensureMasterDataDefaults } from "./scripts/seedMasterDataDefaults";

async function start() {
  try {
    await connectDB();
    await ensureRbacDefaults();
    await ensureMasterDataDefaults();
  } catch (err) {
    logger.error(`Startup error: ${err instanceof Error ? err.message : err}`);
  }

  if (!isDbConnected()) {
    logger.warn("Starting without a DB connection - RBAC defaults were not seeded");
  }

  app.listen(env.PORT, () => {
    logger.info(`IT Asset backend listening on http://localhost:${env.PORT}`);
  });
}

start();
