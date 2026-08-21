import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { verifyToken } from "../utils/jwt";
import { User } from "../models/User";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import { effectivePermissionsFromUser } from "../utils/rbac";

export const authenticate = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
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

  const user = await User.findById(payload.sub)
    .select("status tokenVersion roles")
    .populate({ path: "roles", populate: { path: "permissions" } });

  if (!user || user.status !== "Active") {
    throw new ApiError(401, "Account is inactive or no longer exists");
  }

  if (user.tokenVersion !== payload.tokenVersion) {
    throw new ApiError(401, "Session has been invalidated, please log in again");
  }

  const effective = effectivePermissionsFromUser(user);

  req.user = {
    id: user.id,
    tokenVersion: user.tokenVersion,
    roleNames: effective.roleNames,
    permissions: effective.permissions,
    isSuperAdmin: effective.isSuperAdmin,
  };
  next();
});
