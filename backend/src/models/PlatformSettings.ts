import { Schema, model } from "mongoose";

/** A true global singleton - unlike every other settings-like model in this app (SystemSettings
 * included), this one deliberately carries NO `organization` field: it holds the platform-wide
 * operational config (Phase 9) that today only lives in `.env` with no admin UI at all - rate
 * limit thresholds, login lockout threshold/duration, and the one shared Cloudflare Turnstile key
 * pair (see config/env.ts's own comment on why Turnstile is one pair for the whole deployment,
 * not per-org). Every numeric field is nullable: null means "no override - fall back to the
 * matching env.* value", never a stored copy of the env default itself, so an admin can always
 * tell (and revert to) "unset" cleanly. See modules/platformSettings/platformSettings.service.ts
 * for the lazy-singleton getter and the getEffective*() fallback resolvers built on top of this. */
export interface IPlatformSettings {
  authRateLimitWindowMs: number | null;
  authRateLimitMax: number | null;
  apiRateLimitWindowMs: number | null;
  apiRateLimitMax: number | null;
  loginLockoutThreshold: number | null;
  loginLockoutDurationMinutes: number | null;
  // "" = not configured - falls back to env.TURNSTILE_SITE_KEY/SECRET_KEY. Unlike the numeric
  // fields above, there's no meaningful "explicitly zero" case for a key string, so empty string
  // (matching env.ts's own optional-string convention) doubles as both the default and the
  // "reverted to env" sentinel.
  turnstileSiteKey: string;
  turnstileSecretKey: string;
}

const platformSettingsSchema = new Schema<IPlatformSettings>(
  {
    authRateLimitWindowMs: { type: Number, default: null },
    authRateLimitMax: { type: Number, default: null },
    apiRateLimitWindowMs: { type: Number, default: null },
    apiRateLimitMax: { type: Number, default: null },
    loginLockoutThreshold: { type: Number, default: null },
    loginLockoutDurationMinutes: { type: Number, default: null },
    turnstileSiteKey: { type: String, default: "" },
    // select: false so an accidental future `.find()`/`.lean()` elsewhere can't leak this - the
    // one legitimate internal read (platformSettings.service.ts#loadFresh) explicitly re-selects
    // it. The HTTP-facing controller must never forward this raw value to a client either way -
    // see platformSettings.controller.ts's masking of both the top-level and `effective` field.
    turnstileSecretKey: { type: String, default: "", select: false },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

export const PlatformSettings = model<IPlatformSettings>("PlatformSettings", platformSettingsSchema);
