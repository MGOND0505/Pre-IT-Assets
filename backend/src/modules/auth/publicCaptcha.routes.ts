import { Router } from "express";
import { env } from "../../config/env";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";

/** Flat, unauthenticated - the superAdmin/subSuperAdmin login page has no org slug in its URL
 * at all (unlike the org-scoped login pages, which get this from /public/branding), so it needs
 * its own tiny route to learn whether to render the CAPTCHA widget. Required unconditionally
 * whenever the server has Turnstile configured - see auth.service.ts#resolveCaptchaStatus. */
export const publicCaptchaRouter = Router();

publicCaptchaRouter.get(
  "/captcha-config",
  asyncHandler(async (_req, res) => {
    ok(res, { captchaSiteKey: env.TURNSTILE_SITE_KEY ?? null }, "Captcha config");
  })
);
