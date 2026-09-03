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
  // Options here must match setAuthCookie's (minus maxAge) - browsers only clear a cookie when
  // clearCookie's attributes are identical to the ones it was originally set with, per Express's
  // own documented behavior. A mismatch (this used to only pass `path`) silently no-ops: the
  // Set-Cookie header goes out, but the browser keeps the old cookie, so logout never actually
  // clears the session client-side.
  res.clearCookie(env.JWT_COOKIE_NAME, {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
  });
}
