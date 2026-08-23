import type { NextFunction, Request, Response } from "express";
import type { PermissionAction, PermissionArea } from "../config/permissions";
import { ApiError } from "../utils/ApiError";

/** Passes if the user is Admin, or holds the given action for the given area. */
export function authorize(area: PermissionArea, action: PermissionAction) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, "Not authenticated"));
    }

    const allowed = req.user.isAdmin || Boolean((req.user.permissions[area] as Record<string, boolean>)[action]);

    if (!allowed) {
      return next(new ApiError(403, "You do not have permission to perform this action"));
    }

    next();
  };
}

/** Master-data and user-management routes are Admin-only, not part of the per-area matrix. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new ApiError(401, "Not authenticated"));
  }

  if (!req.user.isAdmin) {
    return next(new ApiError(403, "Admin access required"));
  }

  next();
}
