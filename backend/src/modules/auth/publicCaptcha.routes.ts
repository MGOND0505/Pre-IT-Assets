import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { getEffectiveTurnstileKeys } from "../platformSettings/platformSettings.service";

/** Flat, unauthenticated - the superAdmin/subSuperAdmin login page has no org slug in its URL
 * at all (unlike the org-scoped login pages, which get this from /public/branding), so it needs
 * its own tiny route to learn whether to render the CAPTCHA widget. Required unconditionally
 * whenever the server has Turnstile configured (a Super Admin's Global/Security Settings
 * override or env.TURNSTILE_SITE_KEY - see platformSettings.service.ts#getEffectiveTurnstileKeys)
 * - see auth.service.ts#resolveCaptchaStatus. */
export const publicCaptchaRouter = Router();

publicCaptchaRouter.get(
  "/captcha-config",
  asyncHandler(async (_req, res) => {
    const { siteKey } = await getEffectiveTurnstileKeys();
    ok(res, { captchaSiteKey: siteKey || null }, "Captcha config");
  })
);
