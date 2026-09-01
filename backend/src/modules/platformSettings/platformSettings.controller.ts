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

export const getPlatformSettings = asyncHandler(async (_req: Request, res: Response) => {
  const [settings, effectiveAuth, effectiveApi, effectiveLockout, effectiveTurnstile] = await Promise.all([
    platformSettingsService.getPlatformSettings(),
    platformSettingsService.getEffectiveAuthRateLimit(),
    platformSettingsService.getEffectiveApiRateLimit(),
    platformSettingsService.getEffectiveLoginLockout(),
    platformSettingsService.getEffectiveTurnstileKeys(),
  ]);

  // Ships the raw stored (possibly-null) fields for the form's controlled inputs, plus the
  // resolved "effective" values (stored override, or the env.* fallback) so the frontend can
  // show each blank field's placeholder as "what's actually active right now" - see
  // frontend/app/security-settings/page.tsx.
  ok(res, {
    ...settings,
    effective: {
      authRateLimitWindowMs: effectiveAuth.windowMs,
      authRateLimitMax: effectiveAuth.max,
      apiRateLimitWindowMs: effectiveApi.windowMs,
      apiRateLimitMax: effectiveApi.max,
      loginLockoutThreshold: effectiveLockout.threshold,
      loginLockoutDurationMinutes: effectiveLockout.durationMinutes,
      turnstileSiteKey: effectiveTurnstile.siteKey,
      turnstileSecretKey: effectiveTurnstile.secretKey,
    },
  }, "Platform settings");
});

export const updatePlatformSettings = asyncHandler(async (req: Request, res: Response) => {
  const before = await platformSettingsService.getPlatformSettings();
  const settings = await platformSettingsService.updatePlatformSettings(req.body);

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

  ok(res, settings, "Platform settings updated");
});
