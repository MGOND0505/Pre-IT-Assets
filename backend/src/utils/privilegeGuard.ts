import { ApiError } from "./ApiError";
import { permissionSetHas } from "./rbac";

/**
 * Prevents privilege escalation: a caller can only grant permissions they
 * themselves currently hold, unless they are a Super Admin. Used whenever a
 * caller assigns roles to a user or edits a role's own permission set.
 */
export function assertNoPrivilegeEscalation(
  callerPermissions: string[],
  callerIsSuperAdmin: boolean,
  grantedPermissionKeys: string[]
): void {
  if (callerIsSuperAdmin) return;

  const disallowed = grantedPermissionKeys.filter((key) => !permissionSetHas(callerPermissions, key));

  if (disallowed.length > 0) {
    throw new ApiError(
      403,
      `You cannot grant permissions you do not hold yourself: ${disallowed.join(", ")}`
    );
  }
}
