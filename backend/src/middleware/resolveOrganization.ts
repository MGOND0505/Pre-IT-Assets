import type { NextFunction, Request, Response } from "express";
import { ApiError } from "../utils/ApiError";
import { asyncHandler } from "../utils/asyncHandler";
import * as organizationsService from "../modules/organizations/organizations.service";

/** Suspended covers both a manually-Inactive org and one past its subscription's grace period -
 * see organizations.service.ts#getSubscriptionState, the single source of truth for both. */
function isOrgSuspended(org: Parameters<typeof organizationsService.getSubscriptionState>[0]): boolean {
  return organizationsService.getSubscriptionState(org) === "Suspended";
}

async function findOrgOrThrow(slug: string) {
  const org = await organizationsService.findBySlug(slug);
  // 404, not 403 - never confirm a slug exists to a caller who doesn't have access to it.
  if (!org) throw new ApiError(404, "Organization not found");
  return org;
}

/**
 * Resolves the `:orgSlug` path segment to a real Organization and confirms the authenticated
 * user actually has access to it:
 *  - superAdmin: any organization, including a suspended one (they need to be able to reach it
 *    to review or reactivate it, so the Active-only check is skipped just for them).
 *  - subSuperAdmin: only an organization they hold a grant for (in `req.user.orgAccess`), and
 *    only while it's Active. On success, `req.user.permissions` is OVERWRITTEN in place with
 *    that grant's permissions for the rest of this request - `authorize()` downstream needs no
 *    changes at all, it already reads `req.user.permissions`. `req.user.isAdmin` stays false;
 *    a subSuperAdmin never gets a blanket bypass, "Full Access" is just an all-true grant.
 *  - orgAdmin/teamMember: only their own fixed organization, and only while it's Active.
 *
 * Must run after `authenticate` (needs req.user) and before any `authorize(module, action)`
 * call. Every org-scoped service function downstream must take `req.organization!._id` as an
 * explicit parameter - see plan §5 for why this is deliberately not an implicit auto-scoping
 * mechanism.
 */
export const resolveOrganization = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const org = await findOrgOrThrow(req.params.orgSlug);
  const role = req.user!.role;

  if (role === "superAdmin") {
    // No ownership or active-status check - full, unconditional access.
  } else if (role === "subSuperAdmin") {
    const grant = req.user!.orgAccess.find((g) => g.organization === String(org._id));
    if (!grant) {
      throw new ApiError(403, "You do not have access to this organization");
    }
    if (isOrgSuspended(org)) {
      throw new ApiError(404, "Organization not found");
    }
    req.user!.permissions = grant.permissions;
  } else {
    if (req.user!.organization !== String(org._id)) {
      throw new ApiError(403, "You do not have access to this organization");
    }
    if (isOrgSuspended(org)) {
      throw new ApiError(404, "Organization not found");
    }
  }

  req.organization = { _id: String(org._id), slug: org.slug, name: org.name, enabledModules: org.enabledModules };
  next();
});

/**
 * Same slug resolution, but for the handful of PUBLIC pre-login endpoints (branding, logo)
 * that a login page must be able to fetch before any session/cookie exists - no `req.user`
 * to check ownership against, so there is none to check. A suspended org's login page still
 * shouldn't render real branding, so the Active check always applies here. Never mount
 * anything other than those narrow public read endpoints behind this.
 */
export const resolvePublicOrganization = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const org = await findOrgOrThrow(req.params.orgSlug);
  if (isOrgSuspended(org)) throw new ApiError(404, "Organization not found");
  req.organization = { _id: String(org._id), slug: org.slug, name: org.name, enabledModules: org.enabledModules };
  next();
});
