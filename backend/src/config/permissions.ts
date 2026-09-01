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
  departments: ["view", "create", "update", "delete", "import"],
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

/** The baseline "Employee" permission profile - enough to view their own assets/licenses, file
 * and comment on their own helpdesk tickets (and reopen one they closed themselves, within the
 * window - see helpdesk.service.ts#REOPEN_WINDOW_HOURS), and see/respond to their own tasks,
 * without an admin needing to configure anything first. This is the FALLBACK an organization gets
 * until they configure their own via SystemSettings.defaultEmployeePermissions (Administration >
 * Settings > Employee Default Permissions) - see settings.service.ts#getDefaultEmployeePermissions,
 * the one place that decides between this baseline and an org's own configured template. */
export function basicUserDefaultPermissions(): PermissionsShape {
  const perms = emptyPermissions();
  perms.assets.view = true;
  perms.licenses.view = true;
  perms.helpdesk.view = true;
  perms.helpdesk.create = true;
  perms.helpdesk.comment = true;
  perms.helpdesk.reopen = true;
  perms.tasks.view = true;
  perms.tasks.create = true;
  perms.tasks.comment = true;
  return perms;
}

/** The baseline "Sub Admin" permission profile - broad operational access (assets, licenses,
 * vendors, departments, locations, helpdesk, tasks, reports) without the account-management
 * surface (users, settings, auditLogs) that stays reserved for a true Admin (isAdmin/orgAdmin).
 * The Create User dialog always sends its own explicit permissions for a Sub Admin (this is just
 * the starting point an admin can then edit, mirroring basicUserPermissions() on the frontend) -
 * this function only matters as a server-side fallback for the rare case permissions is omitted
 * entirely for one (bulk import/API misuse), same role users.service.ts#createUser gives
 * basicUserDefaultPermissions() for a plain Employee. */
export function subAdminDefaultPermissions(): PermissionsShape {
  const perms = emptyPermissions();
  const fullAccess = { view: true, create: true, update: true, delete: true, import: true, export: true };
  Object.assign(perms.assets, fullAccess);
  Object.assign(perms.licenses, fullAccess);
  Object.assign(perms.vendors, fullAccess);
  Object.assign(perms.departments, fullAccess);
  Object.assign(perms.locations, fullAccess);
  perms.helpdesk.view = true;
  perms.helpdesk.create = true;
  perms.helpdesk.update = true;
  perms.helpdesk.assign = true;
  perms.helpdesk.reassign = true;
  perms.helpdesk.close = true;
  perms.helpdesk.reopen = true;
  perms.helpdesk.comment = true;
  perms.helpdesk.export = true;
  perms.tasks.view = true;
  perms.tasks.create = true;
  perms.tasks.update = true;
  perms.tasks.assign = true;
  perms.tasks.comment = true;
  perms.reports.view = true;
  return perms;
}
