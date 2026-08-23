export const PERMISSION_AREAS = ["assets", "licenses", "reports"] as const;
export type PermissionArea = (typeof PERMISSION_AREAS)[number];

export const PERMISSION_ACTIONS = ["read", "add", "edit", "delete"] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export type PermissionsShape = {
  assets: { read: boolean; add: boolean; edit: boolean; delete: boolean };
  licenses: { read: boolean; add: boolean; edit: boolean; delete: boolean };
  reports: { read: boolean };
};

export function emptyPermissions(): PermissionsShape {
  return {
    assets: { read: false, add: false, edit: false, delete: false },
    licenses: { read: false, add: false, edit: false, delete: false },
    reports: { read: false },
  };
}
