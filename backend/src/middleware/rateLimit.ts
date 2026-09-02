import rateLimit from "express-rate-limit";
import { env } from "../config/env";
import { fail } from "../utils/response";
import { getEffectiveApiRateLimit, getEffectiveAuthRateLimit } from "../modules/platformSettings/platformSettings.service";

// In-memory rolling counters of 429 rejections, one array per limiter - deliberately NOT a DB
// write per-reject (System Monitoring, Phase 10), since that must stay cheap even under an actual
// burst/attack. Each array holds just reject timestamps; getRecentRateLimitRejects prunes entries
// older than the requested window inline on read, so there's no separate cleanup timer needed at
// this scale (a real attack tops out at a few thousand entries between reads, not worth a timer).
const authRejectTimestamps: number[] = [];
const apiRejectTimestamps: number[] = [];

function pruneOlderThan(timestamps: number[], cutoff: number): number[] {
  while (timestamps.length > 0 && timestamps[0] < cutoff) {
    timestamps.shift();
  }
  return timestamps;
}

/** Recent 429 rejection counts for the auth and API limiters, for the System Monitoring page
 * (GET /api/system-status) - prunes entries older than `windowMs` inline on read. */
export function getRecentRateLimitRejects(windowMs: number = 15 * 60 * 1000): { auth: number; api: number } {
  const cutoff = Date.now() - windowMs;
  return {
    auth: pruneOlderThan(authRejectTimestamps, cutoff).length,
    api: pruneOlderThan(apiRejectTimestamps, cutoff).length,
  };
}

// express-rate-limit v7.4.1 (pinned in this repo's node_modules) lets `limit` be a
// (req,res) => number|Promise<number> resolver, so overriding *Max via the Super Admin's
// Global/Security Settings screen (Phase 9) is genuinely live - no restart needed. `windowMs`,
// however, is a plain number in this version - it is evaluated once, here, at module load
// (server boot), NOT per-request. So a stored authRateLimitWindowMs/apiRateLimitWindowMs
// override only takes effect after the next server restart; env.*_WINDOW_MS is what's actually
// enforced between restarts regardless of what's saved. This is surfaced explicitly in the admin
// UI's helper text (frontend/app/security-settings/page.tsx) so nobody expects it to be instant
// like the *Max fields are.
export const authLimiter = rateLimit({
  windowMs: env.AUTH_RATE_LIMIT_WINDOW_MS,
  limit: async () => (await getEffectiveAuthRateLimit()).max,
  standardHeaders: true,
  legacyHeaders: false,
  // This exists to throttle brute-force guessing, not to cap how often someone can
  // successfully log in - without this, a handful of legitimate logins (or, in a shared-IP
  // dev environment, someone else's) eats the same budget as failed password guesses and
  // locks everyone out for real use.
  skipSuccessfulRequests: true,
  handler: (_req, res) => {
    authRejectTimestamps.push(Date.now());
    fail(res, "Too many attempts, please try again later", 429);
  },
});

export const apiLimiter = rateLimit({
  windowMs: env.API_RATE_LIMIT_WINDOW_MS,
  limit: async () => (await getEffectiveApiRateLimit()).max,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    apiRejectTimestamps.push(Date.now());
    fail(res, "Too many requests, please slow down", 429);
  },
});

// The AI Assistant's /chat endpoint shares apiLimiter's generic per-org budget (a few hundred
// requests/15min) like every other route - nowhere near tight enough for what it actually costs:
// each call can trigger up to MAX_TOOL_ITERATIONS round-trips to the local Ollama inference
// engine, which is real CPU/RAM on a single shared box (see docker-compose.yml's ollama resource
// limits). A single user hammering this endpoint could starve it for the whole organization, so
// it gets its own, much stricter, PER-USER (not per-IP - several org members can share a NAT/
// office IP) budget on top of apiLimiter, not instead of it.
export const aiChatLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user?.id ?? req.ip ?? "unknown",
  handler: (_req, res) => {
    fail(res, "Too many AI Assistant requests - please wait a few minutes and try again", 429);
  },
});
