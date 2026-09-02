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
] as const;
export type PermissionModule = (typeof PERMISSION_MODULES)[number];

/** The subset of modules an organization can be entitled (or not) to via its subscription plan.
 * dashboard/users/settings are core admin surface, not a sellable module - always on.
 * designations joins that "always on" group too, deliberately - unlike departments/locations
 * (which predate this field and are genuine prerequisite master data for sellable feature areas),
 * designations was added later purely to replace User.designation's old free-text field with a
 * managed list; gating it here would need a one-time enabledModules backfill across every
 * existing organization for no real benefit, since nothing would ever want it off while
 * departments stays on. roles joins it too, for the identical reason - named permission-template
 * management is admin config surface (a reuse layer over the same matrix), not a sellable
 * module. knowledgeBase joins it for a related but distinct reason - it's Phase 1 of the AI
 * Assistant rebuild and its `view` action is granted to every user by default (see
 * basicUserDefaultPermissions below), which only makes sense if the module itself is always-on
 * core surface, never a per-org sellable toggle. aiAssistant (Phase 3 of the same rebuild) joins
 * it for the identical reason - its `view` action is also granted to every user by default below,
 * and per this feature's explicit requirement it must NOT be Super-Admin-gate-able per org at all
 * - it's meant to be universally on, not a sellable/toggleable entitlement. auditLogs USED to join this always-on group, but
 * is now Super-Admin-toggleable per org,
 * same as customFields before it - tracking who-did-what is a real, gate-able feature area, not
 * bedrock admin surface. recycleBin is entitlement-only (it never joins PERMISSION_MODULES/
 * MODULE_ACTIONS/PermissionsShape - Recycle Bin stays Admin-only, not part of the granular
 * per-teamMember action matrix); it exists here purely so a Super Admin can gate whether an org's
 * own Admin may reach any module's /deleted, /:id/restore, /:id/purge routes at all. fileUpload
 * is entitlement-only for the same reason as recycleBin - it gates whether per-record file
 * attachments (Asset documents, Ticket attachments, Task attachments) are reachable at all for an
 * org, without adding a new granular per-teamMember action; once enabled, the existing
 * assets/helpdesk/tasks view/manageAttachments permissions still govern who can actually use it. */
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
  // Entitlement-only, same as recycleBin/fileUpload - never joins PERMISSION_MODULES/
  // MODULE_ACTIONS/PermissionsShape. Gates whether an org's own Admin gets a further on/off
  // switch (SystemSettings.changeWarningEnabled, Administration > Settings) for showing a
  // confirm-before-save warning on Asset/License edits and employee status-change actions.
  "changeWarning",
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
  // Read/query capability only, not a CRUD module - the AI Assistant never creates/updates/
  // deletes anything on its own (see the confirm-before-write ticket flow in ai-assistant.*).
  aiAssistant: ["view"],
  // Configuring the Asset Master's structure itself (categories/asset types) - deliberately NOT
  // gated through the normal authorize()/isAdmin bypass (see middleware/authorize.ts's
  // requireAssetConfigAccess): Org Admin and Team Member never get "view" here because listing
  // categories for dropdowns is intentionally left ungated in assetCategories.routes.ts (cross-
  // module data every user needs regardless of this permission), so "view" would be a dead
  // checkbox - only create/update/delete/import (Super Admin/Sub-Super Admin only) are meaningful.
  assetCategories: ["create", "update", "delete", "import"],
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
  // Every user (including a plain Employee) needs read access so a later phase's AI Assistant can
  // search KB articles on their behalf - authoring (create/update/delete) stays Admin/Sub Admin
  // territory, left false here.
  perms.knowledgeBase.view = true;
  // On for everyone by default, per the AI Assistant feature's explicit requirement - not an
  // entitlement, and not gate-able per org (see PERMISSION_MODULES's own comment on aiAssistant).
  perms.aiAssistant.view = true;
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
  Object.assign(perms.knowledgeBase, fullAccess);
  // On for everyone by default, per the AI Assistant feature's explicit requirement - see the
  // identical note in basicUserDefaultPermissions above.
  perms.aiAssistant.view = true;
  return perms;
}
