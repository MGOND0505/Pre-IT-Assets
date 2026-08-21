import { User, type UserDoc } from "../models/User";
import { Role } from "../models/Role";
import type { IPermission } from "../models/Permission";

export type EffectivePermissions = {
  roleNames: string[];
  permissions: string[];
  isSuperAdmin: boolean;
};

const ALL_PERMISSIONS_SENTINEL = "*";

/** Loads a user's roles + their permissions and flattens them into one effective set. */
export async function computeEffectivePermissions(userId: string): Promise<EffectivePermissions> {
  const user = await User.findById(userId).populate({
    path: "roles",
    populate: { path: "permissions" },
  });

  if (!user) {
    return { roleNames: [], permissions: [], isSuperAdmin: false };
  }

  return effectivePermissionsFromUser(user);
}

export function effectivePermissionsFromUser(
  user: UserDoc & { roles: unknown }
): EffectivePermissions {
  const roles =
    (user.roles as unknown as Array<{ name: string; isSuperAdmin: boolean; permissions: IPermission[] }>) ?? [];

  const isSuperAdmin = roles.some((role) => role.isSuperAdmin);
  const roleNames = roles.map((role) => role.name);

  if (isSuperAdmin) {
    return { roleNames, permissions: [ALL_PERMISSIONS_SENTINEL], isSuperAdmin: true };
  }

  const permissionSet = new Set<string>();
  for (const role of roles) {
    for (const permission of role.permissions ?? []) {
      if (permission?.key) permissionSet.add(permission.key);
    }
  }

  return { roleNames, permissions: Array.from(permissionSet), isSuperAdmin: false };
}

export function permissionSetHas(permissions: string[], key: string): boolean {
  return permissions.includes(ALL_PERMISSIONS_SENTINEL) || permissions.includes(key);
}

/** Every permission a user currently holds, by role id - used by the Roles admin UI to show "users by role". */
export async function findRoleIdByName(name: string) {
  const role = await Role.findOne({ name });
  return role?.id ?? null;
}
