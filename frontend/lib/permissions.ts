// Keep this in sync with backend/src/config/permissions.ts.

export const PERMISSION_AREAS = ["assets", "licenses", "reports"] as const
export type PermissionArea = (typeof PERMISSION_AREAS)[number]

export const PERMISSION_ACTIONS = ["read", "add", "edit", "delete"] as const
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]

export type PermissionsShape = {
  assets: { read: boolean; add: boolean; edit: boolean; delete: boolean }
  licenses: { read: boolean; add: boolean; edit: boolean; delete: boolean }
  reports: { read: boolean }
}

export function emptyPermissions(): PermissionsShape {
  return {
    assets: { read: false, add: false, edit: false, delete: false },
    licenses: { read: false, add: false, edit: false, delete: false },
    reports: { read: false },
  }
}

type PermissionAware = { isAdmin: boolean; permissions: PermissionsShape } | null | undefined

export function can(user: PermissionAware, area: PermissionArea, action: PermissionAction): boolean {
  if (!user) return false
  if (user.isAdmin) return true
  const areaPerms = user.permissions[area] as Record<string, boolean>
  return Boolean(areaPerms?.[action])
}
