import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as platformSettingsService from "./platformSettings.service";

/** Never let the raw Turnstile secret key reach an AuditLog document - shows "***" in its place
 * whenever a value carries one, same redaction shape applied to both the before/after snapshot
 * so a diff still shows *that* it changed without revealing what to. */
function redactSecret<T extends { turnstileSecretKey?: unknown }>(value: T): T {
  if (!value || typeof value !== "object" || !("turnstileSecretKey" in value)) return value;
  return { ...value, turnstileSecretKey: "***" };
}

/** The client-facing shape for BOTH getPlatformSettings and updatePlatformSettings - the raw
 * secret must never reach an HTTP response (it used to, via a plain `...settings` spread - a real
 * leak, since any superAdmin session could read it back and replay it against Cloudflare's
 * siteverify API). Mirrors settings.controller.ts#maskSettings's "blank means unchanged" shape:
 * the top-level field blanks to "" (safe to round-trip back on save - see
 * stripUnchangedSecret below), while `effective.turnstileSecretKey` becomes a fixed "***"
 * sentinel when a key IS active - callers only ever check its truthiness for a placeholder,
 * never its literal value, and it's never sent back on save. */
function toClientShape(
  settings: Awaited<ReturnType<typeof platformSettingsService.getPlatformSettings>>,
  effective: {
    auth: { windowMs: number; max: number };
    api: { windowMs: number; max: number };
    lockout: { threshold: number; durationMinutes: number };
    turnstile: { siteKey: string; secretKey: string };
  }
) {
  return {
    ...settings,
    turnstileSecretKey: "",
    effective: {
      authRateLimitWindowMs: effective.auth.windowMs,
      authRateLimitMax: effective.auth.max,
      apiRateLimitWindowMs: effective.api.windowMs,
      apiRateLimitMax: effective.api.max,
      loginLockoutThreshold: effective.lockout.threshold,
      loginLockoutDurationMinutes: effective.lockout.durationMinutes,
      turnstileSiteKey: effective.turnstile.siteKey,
      turnstileSecretKey: effective.turnstile.secretKey ? "***" : "",
    },
  };
}

export const getPlatformSettings = asyncHandler(async (_req: Request, res: Response) => {
  const [settings, effectiveAuth, effectiveApi, effectiveLockout, effectiveTurnstile] = await Promise.all([
    platformSettingsService.getPlatformSettings(),
    platformSettingsService.getEffectiveAuthRateLimit(),
    platformSettingsService.getEffectiveApiRateLimit(),
    platformSettingsService.getEffectiveLoginLockout(),
    platformSettingsService.getEffectiveTurnstileKeys(),
  ]);

  ok(
    res,
    toClientShape(settings, {
      auth: effectiveAuth,
      api: effectiveApi,
      lockout: effectiveLockout,
      turnstile: effectiveTurnstile,
    }),
    "Platform settings"
  );
});

export const updatePlatformSettings = asyncHandler(async (req: Request, res: Response) => {
  const before = await platformSettingsService.getPlatformSettings();

  // Blank/omitted secret means "leave the stored one unchanged" - never overwrite with "",
  // same convention as settings.controller.ts#updateSettings for its own SECRET_FIELDS.
  const input: Record<string, unknown> = { ...req.body };
  if (!input.turnstileSecretKey) delete input.turnstileSecretKey;

  const settings = await platformSettingsService.updatePlatformSettings(input);

  await logAction({
    req,
    action: "UPDATE",
    module: "PlatformSettings",
    oldValue: redactSecret(before),
    newValue: redactSecret(req.body),
    // Truly global - there is no organization to attribute this to (see logAction's own
    // comment on the null fallback for org-agnostic actions).
    organizationId: null,
  });

  const [effectiveAuth, effectiveApi, effectiveLockout, effectiveTurnstile] = await Promise.all([
    platformSettingsService.getEffectiveAuthRateLimit(),
    platformSettingsService.getEffectiveApiRateLimit(),
    platformSettingsService.getEffectiveLoginLockout(),
    platformSettingsService.getEffectiveTurnstileKeys(),
  ]);

  ok(
    res,
    toClientShape(settings, {
      auth: effectiveAuth,
      api: effectiveApi,
      lockout: effectiveLockout,
      turnstile: effectiveTurnstile,
    }),
    "Platform settings updated"
  );
});
