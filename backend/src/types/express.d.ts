import type { EntitlementModule, PermissionsShape } from "../config/permissions";
import type { UserRole } from "../models/User";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        tokenVersion: number;
        role: UserRole;
        isAdmin: boolean;
        organization: string | null;
        // Only ever populated for role === "subSuperAdmin" - their full set of per-org grants.
        orgAccess: { organization: string; permissions: PermissionsShape }[];
        // For orgAdmin/teamMember: their own fixed set. For subSuperAdmin: OVERWRITTEN by
        // resolveOrganization to reflect the CURRENTLY VIEWED org's grant only, once that
        // middleware has run - never read this expecting the user's full grant set for that
        // role; use `orgAccess` for that instead.
        permissions: PermissionsShape;
        department: string | null;
        location: string | null;
      };
      organization?: {
        _id: string;
        slug: string;
        name: string;
        enabledModules: EntitlementModule[];
      };
    }
  }
}

export {};
