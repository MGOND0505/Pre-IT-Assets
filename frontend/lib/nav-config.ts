import {
  LayoutDashboard,
  Building2,
  Boxes,
  KeyRound,
  LifeBuoy,
  ListChecks,
  BarChart3,
  UploadCloud,
  Settings,
  type LucideIcon,
} from "lucide-react"
import type { EntitlementModule, PermissionAction, PermissionModule } from "@/lib/permissions"

export type NavPermission = { area: PermissionModule; action: PermissionAction }

export type NavLeaf = {
  label: string
  href: string
  /** Shown only for a top-level leaf (no parent group) - a child inside a group stays plain
   * indented text, so the icon carries visual weight at the level where it aids scanning. */
  icon?: LucideIcon
  /** Set to false once the page behind this link is actually built. */
  disabled?: boolean
  /** If set, the leaf is hidden unless the user satisfies this permission. */
  permission?: NavPermission
  /** If set, the leaf is hidden unless the current organization's subscription entitles it to
   * this module - independent of the user's own per-module permission grant. */
  requiresModule?: EntitlementModule
  /** If set, the leaf is visible ONLY to a superAdmin - distinct from `permission`, since
   * `can()`'s isAdmin bypass is also true for orgAdmin, not just superAdmin. */
  superAdminOnly?: boolean
  /** If set, the leaf is visible only to an Admin (orgAdmin or superAdmin) - i.e. `user.isAdmin`.
   * Broader than `superAdminOnly`, narrower than a granular `permission` grant (a Team Member
   * with e.g. vendors:delete still never sees this - matches the Recycle Bin's requireAdmin
   * gate server-side). */
  adminOnly?: boolean
  /** If set, `href` is used as-is, NOT prefixed with the current org slug - for the handful of
   * flat, system-level pages (e.g. Sub-Super Admin management) that still need a link from
   * inside the org-scoped dashboard shell. */
  absolute?: boolean
}

export type NavGroup = {
  label: string
  href?: string
  icon?: LucideIcon
  children?: NavLeaf[]
}

export type NavEntry = NavLeaf | NavGroup

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry && Array.isArray((entry as NavGroup).children)
}

/**
 * A simple, flat menu: Dashboard / Assets / Licenses / Reports / Upload Data / Settings.
 * Departments/Locations/Vendors/Users/Audit live under Settings rather than as their own
 * top-level items, to keep the main menu short per spec - each gated by its own granular
 * module permission now, not a blunt "isAdmin" check.
 */
export const navConfig: NavEntry[] = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Organization", href: "/organization", superAdminOnly: true, icon: Building2 },
  {
    label: "Assets",
    icon: Boxes,
    children: [
      { label: "All Assets", href: "/assets", permission: { area: "assets", action: "view" }, requiresModule: "assets" },
      { label: "Add Asset", href: "/assets/add", permission: { area: "assets", action: "create" }, requiresModule: "assets" },
      { label: "Categories", href: "/assets/categories", permission: { area: "assets", action: "view" }, requiresModule: "assets" },
    ],
  },
  {
    label: "Licenses",
    icon: KeyRound,
    children: [
      { label: "All Licenses", href: "/licenses", permission: { area: "licenses", action: "view" }, requiresModule: "licenses" },
      { label: "Add License", href: "/licenses/add", permission: { area: "licenses", action: "create" }, requiresModule: "licenses" },
      { label: "Categories", href: "/licenses/categories", permission: { area: "licenses", action: "view" }, requiresModule: "licenses" },
    ],
  },
  {
    label: "Helpdesk",
    icon: LifeBuoy,
    children: [
      { label: "All Tickets", href: "/helpdesk", permission: { area: "helpdesk", action: "view" }, requiresModule: "helpdesk" },
      { label: "Add Ticket", href: "/helpdesk/add", permission: { area: "helpdesk", action: "create" }, requiresModule: "helpdesk" },
      { label: "Categories", href: "/helpdesk/categories", permission: { area: "helpdesk", action: "view" }, requiresModule: "helpdesk" },
      { label: "Priorities", href: "/helpdesk/priorities", permission: { area: "helpdesk", action: "view" }, requiresModule: "helpdesk" },
      { label: "Support Teams", href: "/helpdesk/teams", permission: { area: "helpdesk", action: "view" }, requiresModule: "helpdesk" },
    ],
  },
  {
    label: "Tasks",
    icon: ListChecks,
    children: [
      { label: "All Tasks", href: "/tasks", permission: { area: "tasks", action: "view" }, requiresModule: "tasks" },
      { label: "Add Task", href: "/tasks/add", permission: { area: "tasks", action: "create" }, requiresModule: "tasks" },
    ],
  },
  { label: "Reports", href: "/reports", permission: { area: "reports", action: "view" }, requiresModule: "reports", icon: BarChart3 },
  {
    label: "Upload Data",
    href: "/upload",
    permission: { area: "assets", action: "import" },
    requiresModule: "assets",
    icon: UploadCloud,
  },
  {
    label: "Settings",
    icon: Settings,
    children: [
      { label: "Users", href: "/users", permission: { area: "users", action: "view" } },
      { label: "Departments", href: "/departments", permission: { area: "departments", action: "view" }, requiresModule: "departments" },
      { label: "Locations", href: "/locations", permission: { area: "locations", action: "view" }, requiresModule: "locations" },
      { label: "Vendors", href: "/vendors", permission: { area: "vendors", action: "view" }, requiresModule: "vendors" },
      { label: "Audit Logs", href: "/administration/audit-logs", permission: { area: "auditLogs", action: "view" } },
      {
        label: "Login History",
        href: "/administration/login-history",
        permission: { area: "auditLogs", action: "view" },
      },
      {
        label: "Notification Templates",
        href: "/administration/notification-templates",
        permission: { area: "settings", action: "view" },
      },
      {
        label: "Notification Logs",
        href: "/administration/notification-logs",
        permission: { area: "settings", action: "view" },
      },
      { label: "System Settings", href: "/administration/settings", permission: { area: "settings", action: "view" } },
      { label: "Recycle Bin", href: "/administration/recycle-bin", adminOnly: true },
    ],
  },
]
