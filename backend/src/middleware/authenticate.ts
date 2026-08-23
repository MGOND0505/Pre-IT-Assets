import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env";
import { verifyToken } from "../utils/jwt";
import { User } from "../models/User";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";

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

  const user = await User.findById(payload.sub).select("status tokenVersion isAdmin permissions department location");

  if (!user || user.status !== "Active") {
    throw new ApiError(401, "Account is inactive or no longer exists");
  }

  if (user.tokenVersion !== payload.tokenVersion) {
    throw new ApiError(401, "Session has been invalidated, please log in again");
  }

  req.user = {
    id: user.id,
    tokenVersion: user.tokenVersion,
    isAdmin: user.isAdmin,
    permissions: user.permissions,
    department: user.department ? String(user.department) : null,
    location: user.location ? String(user.location) : null,
  };
  next();
});
