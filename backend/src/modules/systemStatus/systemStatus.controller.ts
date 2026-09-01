import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { LoginHistory } from "../../models/LoginHistory";
import { listSchedulerRuns } from "../../services/monitoring/schedulerRun.service";
import { getRecentRateLimitRejects } from "../../middleware/rateLimit";

const RATE_LIMIT_WINDOW_MINUTES = 15;
// The exact `reason` literal auth.service.ts#login writes to LoginHistory the moment a failed
// attempt trips the configured lockout threshold (see login()'s `justLocked` branch) - kept in
// sync with that string, not re-derived, so this stays correct if that literal ever changes.
const LOCKOUT_REASON = "account_locked";

/** System Monitoring (Phase 10) - aggregates the three real, cheap, checkable operational signals
 * this app actually has: each of the 5 background schedulers' last-run outcome, recent rate-limit
 * rejection counts, and recent login failure/lockout counts. Deliberately does NOT report
 * CPU/memory/uptime - this app has no infrastructure to report those from. Mounted flat at
 * /api/system-status, behind authenticate + requireSuperAdmin (see app.ts). */
export const getSystemStatus = asyncHandler(async (_req: Request, res: Response) => {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [schedulers, failedLast24h, lockoutsLast24h] = await Promise.all([
    listSchedulerRuns(),
    LoginHistory.countDocuments({ action: "login_failed", createdAt: { $gte: since24h } }),
    LoginHistory.countDocuments({ action: "login_failed", reason: LOCKOUT_REASON, createdAt: { $gte: since24h } }),
  ]);

  const rateLimitRejects = getRecentRateLimitRejects(RATE_LIMIT_WINDOW_MINUTES * 60 * 1000);

  ok(res, {
    schedulers,
    rateLimitRejects: { ...rateLimitRejects, windowMinutes: RATE_LIMIT_WINDOW_MINUTES },
    loginActivity: { failedLast24h, lockoutsLast24h },
  });
});
