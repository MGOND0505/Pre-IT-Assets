import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { verifyToken, signToken } from "../utils/jwt";
import { setAuthCookie, clearAuthCookie } from "../utils/authCookie";
import { User } from "../models/User";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

const IDLE_TIMEOUT_MS = env.SESSION_IDLE_TIMEOUT_MINUTES * 60 * 1000;

export const authenticate = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const token = req.cookies?.[env.JWT_COOKIE_NAME];

  if (!token) {
    throw new ApiError(401, "Not authenticated");
  }

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    throw new ApiError(401, "Invalid or expired session");
  }

  const user = await User.findById(payload.sub).select(
    "status tokenVersion role organization orgAccess permissions department location isDeleted mustChangePassword"
  );

  if (!user || user.isDeleted || user.status !== "Active") {
    throw new ApiError(401, "Account is inactive or no longer exists");
  }

  if (user.tokenVersion !== payload.tokenVersion) {
    throw new ApiError(401, "Session has been invalidated, please log in again");
  }

  // Idle (inactivity) timeout - independent of the JWT's own absolute expiry (JWT_EXPIRES_IN).
  // A token signed before this field existed has no lastActivity at all - treat that as "just
  // became active now" rather than force-logging out every already-signed-in user the moment
  // this deploys.
  const lastActivity = typeof payload.lastActivity === "number" ? payload.lastActivity : Date.now();
  if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
    clearAuthCookie(res);
    throw new ApiError(401, "Session expired due to inactivity, please log in again");
  }

  // Still active - slide the window forward by re-issuing a fresh token/cookie on every
  // authenticated request, so a user who keeps using the app never hits the idle timeout.
  setAuthCookie(res, signToken({ sub: user.id, tokenVersion: user.tokenVersion, lastActivity: Date.now() }));

  // A forced-change password (admin reset, or expired per the org's policy) blocks every route
  // except the few needed to actually comply: reading who-you-are (so the frontend can even
  // learn a change is required), submitting the change itself, and logging out instead.
  const path = req.originalUrl.split("?")[0];
  const isAllowedWhileMustChange =
    (req.method === "PATCH" && path === "/api/auth/change-password") ||
    (req.method === "GET" && path === "/api/auth/me") ||
    (req.method === "POST" && path === "/api/auth/logout");
  if (user.mustChangePassword && !isAllowedWhileMustChange) {
    throw new ApiError(428, "You must change your password before continuing.");
  }

  req.user = {
    id: user.id,
    tokenVersion: user.tokenVersion,
    role: user.role,
    isAdmin: user.isAdmin,
    organization: user.organization ? String(user.organization) : null,
    orgAccess: user.orgAccess.map((grant) => ({
      organization: String(grant.organization),
      permissions: grant.permissions,
    })),
    permissions: user.permissions,
    department: user.department ? String(user.department) : null,
    location: user.location ? String(user.location) : null,
  };

  next();
});
