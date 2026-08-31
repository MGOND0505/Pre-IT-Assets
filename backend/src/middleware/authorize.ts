import type { NextFunction, Request, Response } from "express";
import type { EntitlementModule, PermissionAction, PermissionModule, PermissionsShape } from "../config/permissions";
import { ApiError } from "../utils/ApiError";

/** The one place this check is expressed - both the `authorize()` middleware (for normal HTTP
 * routes) and anything checking permissions outside a route handler (e.g. the AssetIQ AI tool
 * layer, which must re-check a target module's permission itself since a tool call isn't a
 * route) call this, so the two can never drift apart. The `?.` matters: any user whose stored
 * `permissions` document predates a newly-added module simply has no entry there rather than
 * crashing - treated the same as "not granted." */
export function hasPermission(
  user: { isAdmin: boolean; permissions: PermissionsShape },
  moduleKey: PermissionModule,
  action: PermissionAction
): boolean {
  return user.isAdmin || Boolean(user.permissions[moduleKey]?.[action]);
}

export function authorize(moduleKey: PermissionModule, action: PermissionAction) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, "Not authenticated"));
    }

    if (!hasPermission(req.user, moduleKey, action)) {
      return next(new ApiError(403, "You do not have permission to perform this action"));
    }

    next();
  };
}

/** Gates an entire module router behind the organization's subscription entitlements, upstream
 * of any per-action permission check - a teamMember with "Full Access" on licenses still can't
 * reach it if their org's plan doesn't include the licenses module. superAdmin bypasses this,
 * same as every other org-boundary check (resolveOrganization's active-status/grant checks) -
 * they're reviewing/managing on the platform's behalf, not consuming the org's own entitlements. */
export function requireModuleEnabled(moduleKey: EntitlementModule) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (req.user!.role === "superAdmin") return next();
    if (!req.organization!.enabledModules.includes(moduleKey)) {
      return next(new ApiError(403, "This module is not enabled for your organization"));
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

/** System-level organization management (the Super Admin panel) - stricter than requireAdmin,
 * which also passes for orgAdmin (isAdmin is true for both). An orgAdmin must never reach these
 * routes, no matter how permissive their own org's permission grants are. */
export function requireSuperAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.user) {
    return next(new ApiError(401, "Not authenticated"));
  }

  if (req.user.role !== "superAdmin") {
    return next(new ApiError(403, "Super Admin access required"));
  }

  next();
}
