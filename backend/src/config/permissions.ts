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
  "aiAssistant",
] as const;
export type PermissionModule = (typeof PERMISSION_MODULES)[number];

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
  "aiAssistant",
] as const;
export type EntitlementModule = (typeof ENTITLEMENT_MODULES)[number];

/** The 7 helpdesk-only actions exist purely so the Ticket permission matrix can be as granular
 * as the spec asks for (assign vs. reassign vs. close vs. reopen, etc.) without those concepts
 * leaking into every other module - see MODULE_ACTIONS below, which is what actually keeps them
 * inert everywhere else. */
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
] as const;
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/** Which actions actually mean something for a given module - used to keep the permission
 * editor UI from showing dead checkboxes, and to keep authorize() calls honest about what's
 * actually wired to a route. Modules not listed here support the full action set. */
export const MODULE_ACTIONS: Record<PermissionModule, readonly PermissionAction[]> = {
  dashboard: ["view"],
  assets: ["view", "create", "update", "delete", "import", "export", "editAssetId"],
  licenses: ["view", "create", "update", "delete", "import", "export"],
  vendors: ["view", "create", "update", "delete", "import"],
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
  aiAssistant: ["view"],
};

type ModulePermissions = { [action in PermissionAction]: boolean };

export type PermissionsShape = { [module in PermissionModule]: ModulePermissions };

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
  };
}

export function emptyPermissions(): PermissionsShape {
  const shape = {} as PermissionsShape;
  for (const module of PERMISSION_MODULES) {
    shape[module] = emptyModulePermissions();
  }
  return shape;
}
