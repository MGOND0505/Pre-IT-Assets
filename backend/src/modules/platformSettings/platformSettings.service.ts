import { PlatformSettings, type IPlatformSettings } from "../../models/PlatformSettings";
import { env } from "../../config/env";

const CACHE_TTL_MS = 15_000;

let cache: { value: IPlatformSettings; expiresAt: number } | null = null;

async function loadFresh(): Promise<IPlatformSettings> {
  let doc = await PlatformSettings.findOne({});
  if (!doc) doc = await PlatformSettings.create({});
  return doc.toObject();
}

/** Lazy singleton (no org filter - this is the one platform-wide document, see the model's own
 * comment) - creates the document on first access, mirroring settings.service.ts#getSettings's
 * lazy-create shape. Cached in-memory for CACHE_TTL_MS: middleware/rateLimit.ts's live resolver
 * calls the getEffective*() helpers below on every single API request, so a MongoDB round-trip
 * per request would defeat the entire point of a rate limiter. updatePlatformSettings() below
 * refreshes this cache immediately on save, so a change a Super Admin makes is reflected within
 * (at most) the next request or two, not up to a full TTL stale. */
export async function getPlatformSettings(): Promise<IPlatformSettings> {
  if (cache && cache.expiresAt > Date.now()) return cache.value;
  const value = await loadFresh();
  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

export async function updatePlatformSettings(input: Partial<IPlatformSettings>): Promise<IPlatformSettings> {
  let doc = await PlatformSettings.findOne({});
  if (!doc) doc = await PlatformSettings.create({});
  Object.assign(doc, input);
  await doc.save();

  const value = doc.toObject();
  cache = { value, expiresAt: Date.now() + CACHE_TTL_MS };
  return value;
}

/** {windowMs, max} actually enforced by middleware/rateLimit.ts#authLimiter - falls back to
 * env.AUTH_RATE_LIMIT_WINDOW_MS/MAX per-field when the stored override is null. NOTE: only `max`
 * is live (authLimiter's `limit` option supports an async resolver); `windowMs` is read once at
 * server boot (express-rate-limit v7.4.1's `windowMs` option is a plain number, not a resolver) -
 * see that file's comment. */
export async function getEffectiveAuthRateLimit(): Promise<{ windowMs: number; max: number }> {
  const s = await getPlatformSettings();
  return {
    windowMs: s.authRateLimitWindowMs ?? env.AUTH_RATE_LIMIT_WINDOW_MS,
    max: s.authRateLimitMax ?? env.AUTH_RATE_LIMIT_MAX,
  };
}

/** Same shape/fallback rule as getEffectiveAuthRateLimit(), for apiLimiter. */
export async function getEffectiveApiRateLimit(): Promise<{ windowMs: number; max: number }> {
  const s = await getPlatformSettings();
  return {
    windowMs: s.apiRateLimitWindowMs ?? env.API_RATE_LIMIT_WINDOW_MS,
    max: s.apiRateLimitMax ?? env.API_RATE_LIMIT_MAX,
  };
}

/** Used by auth.service.ts's login flow in place of a direct env.LOGIN_LOCKOUT_* read. */
export async function getEffectiveLoginLockout(): Promise<{ threshold: number; durationMinutes: number }> {
  const s = await getPlatformSettings();
  return {
    threshold: s.loginLockoutThreshold ?? env.LOGIN_LOCKOUT_THRESHOLD,
    durationMinutes: s.loginLockoutDurationMinutes ?? env.LOGIN_LOCKOUT_DURATION_MINUTES,
  };
}

/** Used by utils/turnstile.ts, modules/auth/publicCaptcha.routes.ts, and
 * modules/settings/settings.service.ts#updateSettings in place of a direct
 * env.TURNSTILE_SITE_KEY/SECRET_KEY read - falls back to the env value when the stored string is
 * empty, so a deployment with no .env keys at all can still be provisioned entirely through this
 * new admin UI. */
export async function getEffectiveTurnstileKeys(): Promise<{ siteKey: string; secretKey: string }> {
  const s = await getPlatformSettings();
  return {
    siteKey: s.turnstileSiteKey || env.TURNSTILE_SITE_KEY || "",
    secretKey: s.turnstileSecretKey || env.TURNSTILE_SECRET_KEY || "",
  };
}
