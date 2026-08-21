export type PermissionDefinition = {
  module: string;
  action: string;
  key: string;
  description: string;
};

function def(module: string, action: string, description: string): PermissionDefinition {
  return { module, action, key: `${module.toLowerCase()}:${action}`, description };
}

/**
 * The permission catalog. Adding a new module/action here + upserting via
 * seedRbacDefaults + referencing the new key in a route's authorize() call
 * is the entire process for extending RBAC to a new module - no changes
 * needed to authenticate/authorize/User/Role.
 */
export const PERMISSION_CATALOG: PermissionDefinition[] = [
  def("Dashboard", "read", "View the dashboard"),

  def("Assets", "read", "View assets"),
  def("Assets", "create", "Create assets"),
  def("Assets", "write", "Edit assets"),
  def("Assets", "delete", "Delete assets"),
  def("Assets", "assign", "Assign assets to a user/department/location"),
  def("Assets", "transfer", "Transfer assets between users/locations"),
  def("Assets", "retire", "Retire/dispose assets"),

  def("Licenses", "read", "View licenses"),
  def("Licenses", "create", "Create licenses"),
  def("Licenses", "write", "Edit licenses"),
  def("Licenses", "delete", "Delete licenses"),
  def("Licenses", "assign", "Assign licenses to a user/device/department"),
  def("Licenses", "key_reveal", "Reveal a full, unmasked license key"),

  def("Users", "read", "View users"),
  def("Users", "create", "Create users"),
  def("Users", "write", "Edit users"),
  def("Users", "delete", "Delete users"),
  def("Users", "manage_users", "Assign roles to other users"),

  def("Roles", "read", "View roles and permissions"),
  def("Roles", "create", "Create roles"),
  def("Roles", "write", "Edit a role's permissions"),
  def("Roles", "delete", "Delete roles"),

  def("Departments", "read", "View departments"),
  def("Departments", "create", "Create departments"),
  def("Departments", "write", "Edit departments"),
  def("Departments", "delete", "Delete departments"),

  def("Locations", "read", "View locations"),
  def("Locations", "create", "Create locations"),
  def("Locations", "write", "Edit locations"),
  def("Locations", "delete", "Delete locations"),

  def("Vendors", "read", "View vendors"),
  def("Vendors", "create", "Create vendors"),
  def("Vendors", "write", "Edit vendors"),
  def("Vendors", "delete", "Delete vendors"),

  def("Reports", "read", "View reports"),

  def("Audit", "read", "View audit logs and login history"),

  def("Settings", "read", "View system settings"),
  def("Settings", "write", "Edit system settings"),

  def("Renewals", "read", "View renewals"),
  def("Renewals", "write", "Manage renewals"),
];

function keyOf(module: string, action: string): string {
  return `${module.toLowerCase()}:${action}`;
}

export const PERM = {
  DASHBOARD_READ: keyOf("Dashboard", "read"),

  ASSETS_READ: keyOf("Assets", "read"),
  ASSETS_CREATE: keyOf("Assets", "create"),
  ASSETS_WRITE: keyOf("Assets", "write"),
  ASSETS_DELETE: keyOf("Assets", "delete"),
  ASSETS_ASSIGN: keyOf("Assets", "assign"),
  ASSETS_TRANSFER: keyOf("Assets", "transfer"),
  ASSETS_RETIRE: keyOf("Assets", "retire"),

  LICENSES_READ: keyOf("Licenses", "read"),
  LICENSES_CREATE: keyOf("Licenses", "create"),
  LICENSES_WRITE: keyOf("Licenses", "write"),
  LICENSES_DELETE: keyOf("Licenses", "delete"),
  LICENSES_ASSIGN: keyOf("Licenses", "assign"),
  LICENSES_KEY_REVEAL: keyOf("Licenses", "key_reveal"),

  USERS_READ: keyOf("Users", "read"),
  USERS_CREATE: keyOf("Users", "create"),
  USERS_WRITE: keyOf("Users", "write"),
  USERS_DELETE: keyOf("Users", "delete"),
  USERS_MANAGE_USERS: keyOf("Users", "manage_users"),

  ROLES_READ: keyOf("Roles", "read"),
  ROLES_CREATE: keyOf("Roles", "create"),
  ROLES_WRITE: keyOf("Roles", "write"),
  ROLES_DELETE: keyOf("Roles", "delete"),

  DEPARTMENTS_READ: keyOf("Departments", "read"),
  DEPARTMENTS_CREATE: keyOf("Departments", "create"),
  DEPARTMENTS_WRITE: keyOf("Departments", "write"),
  DEPARTMENTS_DELETE: keyOf("Departments", "delete"),

  LOCATIONS_READ: keyOf("Locations", "read"),
  LOCATIONS_CREATE: keyOf("Locations", "create"),
  LOCATIONS_WRITE: keyOf("Locations", "write"),
  LOCATIONS_DELETE: keyOf("Locations", "delete"),

  VENDORS_READ: keyOf("Vendors", "read"),
  VENDORS_CREATE: keyOf("Vendors", "create"),
  VENDORS_WRITE: keyOf("Vendors", "write"),
  VENDORS_DELETE: keyOf("Vendors", "delete"),

  REPORTS_READ: keyOf("Reports", "read"),

  AUDIT_READ: keyOf("Audit", "read"),

  SETTINGS_READ: keyOf("Settings", "read"),
  SETTINGS_WRITE: keyOf("Settings", "write"),

  RENEWALS_READ: keyOf("Renewals", "read"),
  RENEWALS_WRITE: keyOf("Renewals", "write"),
} as const;

export type PermissionKey = (typeof PERM)[keyof typeof PERM];

/** Default permission grants for the 5 seeded roles, by permission key. Seeded once; never overwritten after. */
export const DEFAULT_ROLE_GRANTS: Record<string, { description: string; isSystem: true; isSuperAdmin?: true; keys: PermissionKey[] | "all" }> = {
  "Super Admin": {
    description: "Full system access, including user and permission management.",
    isSystem: true,
    isSuperAdmin: true,
    keys: "all",
  },
  Admin: {
    description: "Manages business data and users based on assigned permissions.",
    isSystem: true,
    keys: [
      PERM.DASHBOARD_READ,
      PERM.ASSETS_READ,
      PERM.ASSETS_CREATE,
      PERM.ASSETS_WRITE,
      PERM.ASSETS_DELETE,
      PERM.ASSETS_ASSIGN,
      PERM.ASSETS_TRANSFER,
      PERM.ASSETS_RETIRE,
      PERM.LICENSES_READ,
      PERM.LICENSES_CREATE,
      PERM.LICENSES_WRITE,
      PERM.LICENSES_DELETE,
      PERM.LICENSES_ASSIGN,
      PERM.LICENSES_KEY_REVEAL,
      PERM.USERS_READ,
      PERM.USERS_CREATE,
      PERM.USERS_WRITE,
      PERM.USERS_DELETE,
      PERM.DEPARTMENTS_READ,
      PERM.DEPARTMENTS_CREATE,
      PERM.DEPARTMENTS_WRITE,
      PERM.DEPARTMENTS_DELETE,
      PERM.LOCATIONS_READ,
      PERM.LOCATIONS_CREATE,
      PERM.LOCATIONS_WRITE,
      PERM.LOCATIONS_DELETE,
      PERM.VENDORS_READ,
      PERM.VENDORS_CREATE,
      PERM.VENDORS_WRITE,
      PERM.VENDORS_DELETE,
      PERM.REPORTS_READ,
      PERM.SETTINGS_READ,
      PERM.SETTINGS_WRITE,
      PERM.RENEWALS_READ,
      PERM.RENEWALS_WRITE,
    ],
  },
  Manager: {
    description: "Creates, views, and edits assigned business data.",
    isSystem: true,
    keys: [
      PERM.DASHBOARD_READ,
      PERM.ASSETS_READ,
      PERM.ASSETS_CREATE,
      PERM.ASSETS_WRITE,
      PERM.ASSETS_ASSIGN,
      PERM.LICENSES_READ,
      PERM.LICENSES_CREATE,
      PERM.LICENSES_WRITE,
      PERM.LICENSES_ASSIGN,
      PERM.DEPARTMENTS_READ,
      PERM.LOCATIONS_READ,
      PERM.VENDORS_READ,
      PERM.REPORTS_READ,
      PERM.RENEWALS_READ,
    ],
  },
  User: {
    description: "Access only the modules and permissions assigned by an Admin.",
    isSystem: true,
    keys: [PERM.DASHBOARD_READ],
  },
  "Read Only": {
    description: "View-only access across the system.",
    isSystem: true,
    keys: [
      PERM.DASHBOARD_READ,
      PERM.ASSETS_READ,
      PERM.LICENSES_READ,
      PERM.USERS_READ,
      PERM.ROLES_READ,
      PERM.DEPARTMENTS_READ,
      PERM.LOCATIONS_READ,
      PERM.VENDORS_READ,
      PERM.REPORTS_READ,
      PERM.AUDIT_READ,
      PERM.SETTINGS_READ,
      PERM.RENEWALS_READ,
    ],
  },
};

/** role -> old User's legacy `role` string, for the one-time migration script. */
export const LEGACY_ROLE_MIGRATION: Record<string, string> = {
  SuperAdmin: "Super Admin",
  ITManager: "Admin",
  ITExecutive: "Manager",
  Viewer: "Read Only",
};
