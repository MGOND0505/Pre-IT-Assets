// Keep PERM keys in sync with backend/src/config/permissionCatalog.ts.
// Everything else (which roles grant which keys) now lives in the database and is
// read straight off `/auth/me` via AuthContext - no static role->permission map here anymore.

export const PERM = {
  DASHBOARD_READ: "dashboard:read",

  ASSETS_READ: "assets:read",
  ASSETS_CREATE: "assets:create",
  ASSETS_WRITE: "assets:write",
  ASSETS_DELETE: "assets:delete",
  ASSETS_ASSIGN: "assets:assign",
  ASSETS_TRANSFER: "assets:transfer",
  ASSETS_RETIRE: "assets:retire",

  LICENSES_READ: "licenses:read",
  LICENSES_CREATE: "licenses:create",
  LICENSES_WRITE: "licenses:write",
  LICENSES_DELETE: "licenses:delete",
  LICENSES_ASSIGN: "licenses:assign",
  LICENSES_KEY_REVEAL: "licenses:key_reveal",

  USERS_READ: "users:read",
  USERS_CREATE: "users:create",
  USERS_WRITE: "users:write",
  USERS_DELETE: "users:delete",
  USERS_MANAGE_USERS: "users:manage_users",

  ROLES_READ: "roles:read",
  ROLES_CREATE: "roles:create",
  ROLES_WRITE: "roles:write",
  ROLES_DELETE: "roles:delete",

  DEPARTMENTS_READ: "departments:read",
  DEPARTMENTS_CREATE: "departments:create",
  DEPARTMENTS_WRITE: "departments:write",
  DEPARTMENTS_DELETE: "departments:delete",

  LOCATIONS_READ: "locations:read",
  LOCATIONS_CREATE: "locations:create",
  LOCATIONS_WRITE: "locations:write",
  LOCATIONS_DELETE: "locations:delete",

  VENDORS_READ: "vendors:read",
  VENDORS_CREATE: "vendors:create",
  VENDORS_WRITE: "vendors:write",
  VENDORS_DELETE: "vendors:delete",

  REPORTS_READ: "reports:read",

  AUDIT_READ: "audit:read",

  SETTINGS_READ: "settings:read",
  SETTINGS_WRITE: "settings:write",

  RENEWALS_READ: "renewals:read",
  RENEWALS_WRITE: "renewals:write",
} as const

export type PermissionKey = (typeof PERM)[keyof typeof PERM]

type PermissionAware = { permissions: string[]; isSuperAdmin?: boolean } | null | undefined

export function hasPermission(user: PermissionAware, key: PermissionKey): boolean {
  if (!user) return false
  if (user.isSuperAdmin) return true
  return user.permissions.includes(key)
}
