import type { Response } from "express";
import { env } from "../config/env";
import { parseDurationMs } from "./duration";

/** Shared by auth.controller.ts (issuing a fresh session on login) and
 * middleware/authenticate.ts (sliding the session forward on every active request) - one place
 * for the cookie's actual options so they can never drift apart between the two call sites. */
export function setAuthCookie(res: Response, token: string) {
  res.cookie(env.JWT_COOKIE_NAME, token, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    maxAge: parseDurationMs(env.JWT_EXPIRES_IN),
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(env.JWT_COOKIE_NAME, { path: "/" });
}
