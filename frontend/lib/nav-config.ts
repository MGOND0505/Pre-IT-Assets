import { PERM, type PermissionKey } from "@/lib/permissions"

export type NavLeaf = {
  label: string
  href: string
  /** Set to false once the page behind this link is actually built. */
  disabled?: boolean
  /** If set, the leaf is hidden for users lacking this permission. */
  permission?: PermissionKey
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
 * Full navigation tree per spec section 40. Most leaves start `disabled: true`
 * and are flipped to `false` in the phase that actually builds the page.
 */
export const navConfig: NavEntry[] = [
  { label: "Dashboard", href: "/" },
  {
    label: "Assets",
    children: [
      { label: "Dashboard", href: "/assets/dashboard", disabled: true },
      { label: "All Assets", href: "/assets", permission: PERM.ASSETS_READ },
      { label: "Add Asset", href: "/assets/add", permission: PERM.ASSETS_CREATE },
      { label: "Categories", href: "/assets/categories", permission: PERM.ASSETS_READ },
      { label: "Assignments", href: "/assets/assignments", permission: PERM.ASSETS_READ },
      { label: "Transfers", href: "/assets/transfers", permission: PERM.ASSETS_READ },
      { label: "Warranty", href: "/assets/warranty", disabled: true },
      { label: "AMC", href: "/assets/amc", disabled: true },
      { label: "Reports", href: "/assets/reports", disabled: true },
    ],
  },
  {
    label: "Licenses",
    children: [
      { label: "Dashboard", href: "/licenses/dashboard", disabled: true },
      { label: "All Licenses", href: "/licenses", disabled: true },
      { label: "Add License", href: "/licenses/add", disabled: true },
      { label: "Assignments", href: "/licenses/assignments", disabled: true },
      { label: "Utilization", href: "/licenses/utilization", disabled: true },
      { label: "Renewals", href: "/licenses/renewals", disabled: true },
      { label: "Compliance", href: "/licenses/compliance", disabled: true },
      { label: "Categories", href: "/licenses/categories", permission: PERM.LICENSES_READ },
      { label: "Reports", href: "/licenses/reports", disabled: true },
    ],
  },
  { label: "Users", href: "/users", permission: PERM.USERS_READ },
  { label: "Departments", href: "/departments", permission: PERM.DEPARTMENTS_READ },
  { label: "Locations", href: "/locations", permission: PERM.LOCATIONS_READ },
  { label: "Vendors", href: "/vendors", permission: PERM.VENDORS_READ },
  { label: "Reports", href: "/reports", disabled: true },
  {
    label: "Administration",
    children: [
      { label: "Roles", href: "/administration/roles", permission: PERM.ROLES_READ },
      { label: "Audit Logs", href: "/administration/audit-logs", permission: PERM.AUDIT_READ },
      { label: "Login History", href: "/administration/login-history", permission: PERM.AUDIT_READ },
      { label: "Settings", href: "/administration/settings", permission: PERM.SETTINGS_READ },
    ],
  },
]
