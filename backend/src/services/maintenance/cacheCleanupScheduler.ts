import cron from "node-cron";
import fs from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import { DAY_MS } from "../../utils/recycleBin";
import { logger } from "../../utils/logger";
import { recordSchedulerRun, getSchedulerRun, SCHEDULER_KEYS } from "../monitoring/schedulerRun.service";

const execAsync = promisify(exec);

/** How often this actually does anything, regardless of how often the cron trigger below fires -
 * cron's own fields can't express "every 48 hours" directly (its hour field maxes out at 23), so
 * the real interval is gated here against the scheduler's own last-run timestamp instead. */
const CLEANUP_INTERVAL_MS = 2 * DAY_MS; // 48 hours

/** Deletes a stray *.log file (e.g. a pre-PM2 app.log, or anything pm2-logrotate missed) only if
 * it's older than 2 days - never touches dist/, node_modules, or anything currently in use. */
async function removeOldLogFiles(dir: string): Promise<number> {
  let removed = 0;
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return 0;
  }
  const cutoff = Date.now() - 2 * DAY_MS;
  for (const entry of entries) {
    if (!entry.endsWith(".log")) continue;
    const fullPath = path.join(dir, entry);
    try {
      const stat = await fs.stat(fullPath);
      if (stat.isFile() && stat.mtimeMs < cutoff) {
        await fs.unlink(fullPath);
        removed += 1;
      }
    } catch {
      // Already gone, or a permissions hiccup - not worth failing the whole sweep over one file.
    }
  }
  return removed;
}

/** Runs the actual cleanup: npm's package cache, pm2's own log files (production only - a no-op
 * error swallowed on a machine with no pm2, e.g. local dev), and stray *.log files in the
 * backend's own working directory. Disk-space housekeeping only - never touches dist/,
 * node_modules, or anything the running app actually needs. */
export async function runCacheCleanup(): Promise<{ removedLogFiles: number }> {
  await execAsync("npm cache clean --force").catch((err) => {
    logger.warn(`cacheCleanup: npm cache clean failed (non-fatal): ${err instanceof Error ? err.message : err}`);
  });

  await execAsync("pm2 flush").catch(() => {
    /* no pm2 on this machine (e.g. local dev) - nothing to flush, not an error */
  });

  const removedLogFiles = await removeOldLogFiles(process.cwd());
  return { removedLogFiles };
}

/** Cron fires once a day (checked, not necessarily acted on) at 04:00 server time - offset from
 * every other daily scheduler. The actual 48-hour cadence is enforced by the lastRunAt gate
 * above, so this only really does anything on every other check. */
export function startCacheCleanupScheduler(): void {
  cron.schedule("0 4 * * *", () => {
    getSchedulerRun(SCHEDULER_KEYS.cacheCleanup)
      .then(async (last) => {
        if (last && Date.now() - last.lastRunAt.getTime() < CLEANUP_INTERVAL_MS) return;
        const { removedLogFiles } = await runCacheCleanup();
        await recordSchedulerRun(SCHEDULER_KEYS.cacheCleanup, { success: true, itemCount: removedLogFiles, errorMessage: null });
        logger.info(`Cache cleanup ran (removed ${removedLogFiles} stale log file(s))`);
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(`Cache cleanup failed: ${message}`);
        recordSchedulerRun(SCHEDULER_KEYS.cacheCleanup, { success: false, itemCount: 0, errorMessage: message }).catch(() => {});
      });
  });
  logger.info("Cache cleanup scheduler started (checked daily at 04:00, acts every 48 hours)");
}
