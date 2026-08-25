// Keep this in sync with backend/src/config/permissions.ts.

export const PERMISSION_MODULES = [
  "dashboard",
  "assets",
  "licenses",
  "vendors",
  "departments",
  "locations",
  "users",
  "reports",
  "auditLogs",
  "settings",
  "helpdesk",
  "tasks",
] as const
export type PermissionModule = (typeof PERMISSION_MODULES)[number]

/** The subset of modules an organization can be entitled (or not) to via its subscription plan.
 * dashboard/users/auditLogs/settings are core admin surface, not a sellable module - always on. */
export const ENTITLEMENT_MODULES = [
  "assets",
  "licenses",
  "vendors",
  "departments",
  "locations",
  "reports",
  "helpdesk",
  "tasks",
] as const
export type EntitlementModule = (typeof ENTITLEMENT_MODULES)[number]

export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "update",
  "delete",
  "import",
  "export",
  "assign",
  "reassign",
  "close",
  "reopen",
  "comment",
  "internalNote",
  "manageAttachments",
  "editAssetId",
] as const
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number]

/** Which actions actually mean something for a given module - keeps the permission editor from
 * showing dead checkboxes (e.g. Dashboard has no "Delete"). */
export const MODULE_ACTIONS: Record<PermissionModule, readonly PermissionAction[]> = {
  dashboard: ["view"],
  assets: ["view", "create", "update", "delete", "import", "export", "editAssetId"],
  licenses: ["view", "create", "update", "delete", "import", "export"],
  vendors: ["view", "create", "update", "delete"],
  departments: ["view", "create", "update", "delete"],
  locations: ["view", "create", "update", "delete"],
  users: ["view", "create", "update", "delete"],
  reports: ["view"],
  auditLogs: ["view"],
  settings: ["view", "update"],
  helpdesk: [
    "view",
    "create",
    "update",
    "delete",
    "assign",
    "reassign",
    "close",
    "reopen",
    "comment",
    "internalNote",
    "manageAttachments",
    "export",
  ],
  tasks: ["view", "create", "update", "delete", "assign"],
}

export const MODULE_LABELS: Record<PermissionModule, string> = {
  dashboard: "Dashboard",
  assets: "IT Assets",
  licenses: "Licenses",
  vendors: "Vendors",
  departments: "Departments",
  locations: "Locations",
  users: "Users",
  reports: "Reports",
  auditLogs: "Audit Logs",
  settings: "Settings",
  helpdesk: "Helpdesk",
  tasks: "Tasks",
}

type ModulePermissions = { [action in PermissionAction]: boolean }

export type PermissionsShape = { [module in PermissionModule]: ModulePermissions }

function emptyModulePermissions(): ModulePermissions {
  return {
    view: false,
    create: false,
    update: false,
    delete: false,
    import: false,
    export: false,
    assign: false,
    reassign: false,
    close: false,
    reopen: false,
    comment: false,
    internalNote: false,
    manageAttachments: false,
    editAssetId: false,
  }
}

export function emptyPermissions(): PermissionsShape {
  const shape = {} as PermissionsShape
  for (const moduleKey of PERMISSION_MODULES) {
    shape[moduleKey] = emptyModulePermissions()
  }
  return shape
}

type PermissionAware = { isAdmin: boolean; permissions: PermissionsShape } | null | undefined

// Mirrors the backend's authorize(): isAdmin || permissions[module][action].
export function can(user: PermissionAware, moduleKey: PermissionModule, action: PermissionAction): boolean {
  if (!user) return false
  if (user.isAdmin) return true
  return Boolean(user.permissions[moduleKey]?.[action])
}
