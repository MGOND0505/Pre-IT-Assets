import type { Request, Response } from "express";
import { env } from "../../config/env";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { parseDurationMs } from "../../utils/duration";
import { User } from "../../models/User";
import * as authService from "./auth.service";

function setAuthCookie(res: Response, token: string) {
  res.cookie(env.JWT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: parseDurationMs(env.JWT_EXPIRES_IN),
  });
}

function clearAuthCookie(res: Response) {
  res.clearCookie(env.JWT_COOKIE_NAME, { path: "/" });
}

async function serializeCurrentUser(userId: string) {
  const user = await User.findById(userId).populate("department", "name").populate("location", "name");
  if (!user) return null;

  return user.toJSON();
}

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body;
  const { token, user } = await authService.login(req, email, password);

  setAuthCookie(res, token);
  const profile = await serializeCurrentUser(user.id);
  ok(res, profile, "Logged in");
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  if (req.user) {
    const user = await User.findById(req.user.id).select("email");
    if (user) {
      await authService.recordLogout(req, user.id, user.email);
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
  await authService.forgotPassword(req.body.email);
  ok(res, null, "If that email exists, a reset link has been sent");
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.resetPassword(req.params.token, req.body.newPassword);
  ok(res, null, "Password has been reset, please log in");
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  await authService.changePassword(req, req.user!.id, req.body.currentPassword, req.body.newPassword);
  clearAuthCookie(res);
  ok(res, null, "Password changed, please log in again");
});
