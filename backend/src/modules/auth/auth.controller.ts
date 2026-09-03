import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { User } from "../../models/User";
import * as authService from "./auth.service";
import { getPasswordPolicy, getChangeWarningEnabled } from "../settings/settings.service";
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
  const changeWarningEnabled = organizationId ? await getChangeWarningEnabled(organizationId) : false;

  return { ...user.toJSON(), passwordPolicy, changeWarningEnabled };
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
    // No .select(...) restriction here - User's pre("validate") hook reads role, organization,
    // AND orgAccess (among others) to decide what's allowed/required for this account's role, and
    // it runs on every save() regardless of which fields were actually modified. A partial
    // projection leaves whichever fields it omits as undefined, and the hook throws or crashes on
    // those (e.g. "orgAdmin/teamMember must belong to an organization" when role was omitted, or
    // a TypeError on orgAccess.length when that was) even for a perfectly valid account - so load
    // the whole document rather than re-guessing which fields the hook happens to touch today.
    const user = await User.findById(req.user.id);
    if (user) {
      await authService.recordLogout(req, user.id, user.email, user.organization ? String(user.organization) : null);
      // Without this, clearing the cookie only stops THIS browser from sending the token again -
      // a copy of it (XSS, a shared/compromised device, a proxy log) would keep working for the
      // rest of its JWT_EXPIRES_IN lifetime even after the user clicks Logout. Bumping
      // tokenVersion (the same mechanism every other "invalidate now" action in this app already
      // uses - password change, permission change, deactivation) makes Logout actually mean
      // something for a compromised session, at the cost of also signing the user out of any
      // other device they're logged into elsewhere - an accepted tradeoff given this app has no
      // per-device/per-session token concept to invalidate more narrowly.
      user.tokenVersion += 1;
      await user.save();
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
  await authService.resetPassword(req.body.token, req.body.newPassword, req.body.captchaToken, req.ip);
  ok(res, null, "Password has been reset, please log in");
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.changePassword(req, req.user!.id, req.body.currentPassword, req.body.newPassword);
  clearAuthCookie(res);
  ok(res, null, "Password changed, please log in again");
});
