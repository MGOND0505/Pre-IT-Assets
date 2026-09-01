// Keep this in sync with backend/src/config/permissions.ts.

export const PERMISSION_MODULES = [
  "dashboard",
  "assets",
  "licenses",
  "vendors",
  "departments",
  "designations",
  "locations",
  "users",
  "reports",
  "auditLogs",
  "settings",
  "helpdesk",
  "tasks",
  "customFields",
  "roles",
  "knowledgeBase",
  "aiAssistant",
] as const
export type PermissionModule = (typeof PERMISSION_MODULES)[number]

/** The subset of modules an organization can be entitled (or not) to via its subscription plan.
 * dashboard/users/settings are core admin surface, not a sellable module - always on. auditLogs
 * USED to join that always-on group, but is now Super-Admin-toggleable per org, same as
 * customFields before it. recycleBin is entitlement-only (never joins PERMISSION_MODULES/
 * MODULE_ACTIONS/PermissionsShape - Recycle Bin stays Admin-only, not part of the granular
 * per-teamMember action matrix). */
export const ENTITLEMENT_MODULES = [
  "assets",
  "licenses",
  "vendors",
  "departments",
  "locations",
  "reports",
  "helpdesk",
  "tasks",
  "customFields",
  "recycleBin",
  "auditLogs",
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
  vendors: ["view", "create", "update", "delete", "import"],
  departments: ["view", "create", "update", "delete", "import"],
  designations: ["view", "create", "update", "delete"],
  locations: ["view", "create", "update", "delete", "import"],
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
  tasks: ["view", "create", "update", "delete", "assign", "comment"],
  customFields: ["view", "create", "update", "delete"],
  roles: ["view", "create", "update", "delete"],
  knowledgeBase: ["view", "create", "update", "delete"],
  aiAssistant: ["view"],
}

// Record<PermissionModule | EntitlementModule, string> (not just PermissionModule) because
// recycleBin is entitlement-only - it never joins PERMISSION_MODULES/MODULE_ACTIONS/
// PermissionsShape (Recycle Bin stays Admin-only, not part of the granular per-teamMember action
// matrix) - yet ModuleAccessPanel still needs a label for it, same as every other entitlement.
export const MODULE_LABELS: Record<PermissionModule | EntitlementModule, string> = {
  dashboard: "Dashboard",
  assets: "IT Assets",
  licenses: "Licenses",
  vendors: "Vendors",
  departments: "Departments",
  designations: "Designations",
  locations: "Locations",
  users: "Users",
  reports: "Reports",
  auditLogs: "Audit Logs",
  settings: "Settings",
  helpdesk: "Helpdesk",
  tasks: "Tasks",
  customFields: "Custom Fields",
  roles: "Roles & Permissions",
  knowledgeBase: "Knowledge Base",
  aiAssistant: "AI Assistant",
  recycleBin: "Recycle Bin",
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
