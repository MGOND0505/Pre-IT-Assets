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
  "assetCategories",
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
  "fileUpload",
  "changeWarning",
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
  tasks: ["view", "create", "update", "delete", "assign", "comment", "manageAttachments"],
  customFields: ["view", "create", "update", "delete"],
  roles: ["view", "create", "update", "delete"],
  knowledgeBase: ["view", "create", "update", "delete"],
  aiAssistant: ["view"],
  // Configuring Asset Categories/Types - Super Admin/Sub-Super Admin only, see the backend's
  // matching comment in config/permissions.ts. "view" is deliberately absent (listing categories
  // for dropdowns is intentionally ungated - every user needs it regardless of this permission).
  assetCategories: ["create", "update", "delete", "import"],
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
  assetCategories: "Asset Categories & Types",
  fileUpload: "File Upload",
  changeWarning: "Change Warning",
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

type RoleAware = { role: string; permissions: PermissionsShape } | null | undefined

// Mirrors the backend's requireAssetConfigAccess() - deliberately NOT can(): Org Admin's isAdmin
// bypass and a Team Member's granted permission must never pass here, only Super Admin
// (unconditional) or Sub-Super Admin (their per-org grant, already merged into `user.permissions`
// - see auth-context.tsx). Gates the Asset Categories/Types admin UI and, for module "assets",
// the custom-field admin UI.
export function canConfigureAssetStructure(user: RoleAware, moduleKey: PermissionModule, action: PermissionAction): boolean {
  if (!user) return false
  if (user.role === "superAdmin") return true
  if (user.role === "subSuperAdmin") return Boolean(user.permissions[moduleKey]?.[action])
  return false
}

type ModuleAware = { role: string; organization: { enabledModules: EntitlementModule[] } | null } | null | undefined

// Mirrors the backend's requireModuleEnabled(): superAdmin always passes, everyone else needs the
// currently-viewed org to actually have the module entitled. Same bypass rule sidebar-nav.tsx and
// employee-dashboard.tsx already inline per-module - this is the shared version for new call sites.
export function hasModule(user: ModuleAware, moduleKey: EntitlementModule): boolean {
  if (!user) return false
  if (user.role === "superAdmin") return true
  return Boolean(user.organization?.enabledModules.includes(moduleKey))
}

// Two-layer gate for the Change Warning feature: the org must be entitled (Super Admin, per
// org) AND the org's own Admin must have turned it on (Administration > Settings). Any
// authenticated user (not just Admins) needs this - see auth-context.tsx's CurrentUser/
// MyAccessResponse, which carry changeWarningEnabled alongside organization.enabledModules.
export function shouldWarnBeforeChange(
  user: (ModuleAware & { changeWarningEnabled?: boolean }) | null | undefined
): boolean {
  return hasModule(user, "changeWarning") && Boolean(user?.changeWarningEnabled)
}
