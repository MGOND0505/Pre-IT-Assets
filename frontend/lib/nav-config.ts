import type { PermissionAction, PermissionArea } from "@/lib/permissions"

export type NavPermission = { area: PermissionArea; action: PermissionAction } | "admin"

export type NavLeaf = {
  label: string
  href: string
  /** Set to false once the page behind this link is actually built. */
  disabled?: boolean
  /** If set, the leaf is hidden unless the user satisfies this permission. */
  permission?: NavPermission
}

export type NavGroup = {
  label: string
  href?: string
  children?: NavLeaf[]
}

export type NavEntry = NavLeaf | NavGroup

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "children" in entry && Array.isArray((entry as NavGroup).children)
}

/**
 * A simple, flat menu: Dashboard / Assets / Licenses / Reports / Upload Data / Settings.
 * Departments/Locations/Vendors/Users/Audit are Admin-only master data and live under Settings
 * rather than as their own top-level items, to keep the main menu short per spec.
 */
export const navConfig: NavEntry[] = [
  { label: "Dashboard", href: "/" },
  {
    label: "Assets",
    children: [
      { label: "All Assets", href: "/assets", permission: { area: "assets", action: "read" } },
      { label: "Add Asset", href: "/assets/add", permission: { area: "assets", action: "add" } },
      { label: "Categories", href: "/assets/categories", permission: { area: "assets", action: "read" } },
    ],
  },
  {
    label: "Licenses",
    children: [
      { label: "All Licenses", href: "/licenses", permission: { area: "licenses", action: "read" } },
      { label: "Add License", href: "/licenses/add", permission: { area: "licenses", action: "add" } },
      { label: "Categories", href: "/licenses/categories", permission: { area: "licenses", action: "read" } },
    ],
  },
  { label: "Reports", href: "/reports", permission: { area: "reports", action: "read" } },
  { label: "Upload Data", href: "/upload", permission: { area: "assets", action: "add" } },
  {
    label: "Settings",
    children: [
      { label: "Users", href: "/users", permission: "admin" },
      { label: "Departments", href: "/departments", permission: "admin" },
      { label: "Locations", href: "/locations", permission: "admin" },
      { label: "Vendors", href: "/vendors", permission: "admin" },
      { label: "Audit Logs", href: "/administration/audit-logs", permission: "admin" },
      { label: "Login History", href: "/administration/login-history", permission: "admin" },
      { label: "System Settings", href: "/administration/settings", permission: "admin" },
    ],
  },
]
