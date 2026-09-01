import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import * as platformSettingsService from "./platformSettings.service";

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
  const settings = await platformSettingsService.updatePlatformSettings(req.body);
  ok(res, settings, "Platform settings updated");
});
