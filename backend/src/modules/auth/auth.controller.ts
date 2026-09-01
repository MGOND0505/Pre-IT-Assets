import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { User } from "../../models/User";
import * as authService from "./auth.service";
import { getPasswordPolicy } from "../settings/settings.service";
import { BASELINE_POLICY } from "../../utils/passwordPolicy";
import { setAuthCookie, clearAuthCookie } from "../../utils/authCookie";

async function serializeCurrentUser(userId: string) {
  const user = await User.findById(userId)
    .populate("organization", "name slug enabledModules")
    .populate("department", "name")
    .populate("location", "name");
  if (!user) return null;

  // user.organization is now a POPULATED document, not the raw ObjectId - Document#populated()
  // returns the original id regardless, avoiding the classic "String(populatedDoc)" bug.
  const organizationId = user.populated("organization") as string | undefined;
  const passwordPolicy = organizationId ? await getPasswordPolicy(organizationId) : BASELINE_POLICY;

  return { ...user.toJSON(), passwordPolicy };
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password, orgSlug, captchaToken, portal } = req.body;
  const { token, user, passwordExpiryWarning } = await authService.login(req, email, password, orgSlug, captchaToken, portal);

  setAuthCookie(res, token);
  const profile = await serializeCurrentUser(user.id);
  ok(res, { ...profile, passwordExpiryWarning }, "Logged in");
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    const user = await User.findById(req.user.id).select("email organization");
    if (user) {
      await authService.recordLogout(req, user.id, user.email, user.organization ? String(user.organization) : null);
    }
  }

  clearAuthCookie(res);
  ok(res, null, "Logged out");
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const profile = await serializeCurrentUser(req.user!.id);
  ok(res, profile, "Current user");
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.forgotPassword(req.body.email, req.body.orgSlug, req.body.captchaToken, req.ip);
  ok(res, null, "If that email exists, a reset link has been sent");
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.params.token, req.body.newPassword, req.body.captchaToken, req.ip);
  ok(res, null, "Password has been reset, please log in");
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.changePassword(req, req.user!.id, req.body.currentPassword, req.body.newPassword);
  clearAuthCookie(res);
  ok(res, null, "Password changed, please log in again");
});
