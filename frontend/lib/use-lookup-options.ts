"use client"

import * as React from "react"
import { apiClient, type ApiEnvelope } from "@/lib/api-client"

type Paginated<T> = { items: T[] }

function useLookup<T>(endpoint: string, limit = 100) {
  const [items, setItems] = React.useState<T[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    apiClient
      .get<ApiEnvelope<Paginated<T>>>(endpoint, { params: { limit, status: "Active" } })
      .then((res) => setItems(res.data.data.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [endpoint, limit])

  return { items, loading }
}

// Same shape as useLookup, minus the "status: Active" param - Asset's own status enum (In Stock /
// Assigned / Under Repair / ...) has no "Active" value, so reusing useLookup as-is would fail the
// backend's listAssetsQuerySchema validation and silently return an empty list.
function useLookupWithoutStatusFilter<T>(endpoint: string, limit = 100) {
  const [items, setItems] = React.useState<T[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    apiClient
      .get<ApiEnvelope<Paginated<T>>>(endpoint, { params: { limit } })
      .then((res) => setItems(res.data.data.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [endpoint, limit])

  return { items, loading }
}

export type AssetCategoryOption = {
  _id: string
  name: string
  prefix: string
  group: string
  // null = uncurated (show every Hardware/Security core field, the pre-redesign default);
  // an array (possibly empty) = an explicit curated list from Asset Category management.
  visibleCoreFields: string[] | null
  // null = use the Assets list's default column set; an array (possibly empty) = an explicit
  // curated column set, shown only while the list is filtered to exactly this one category.
  listColumns: string[] | null
}
export type LicenseCategoryOption = { _id: string; name: string }
export type VendorOption = { _id: string; name: string }
export type LocationOption = { _id: string; name: string }
export type DepartmentOption = { _id: string; name: string }
export type DesignationOption = { _id: string; name: string }
export type UserOption = { _id: string; name: string; email: string; employeeId?: string }
export type RolePortalType = "subAdmin" | "employee"
export type RoleOption = {
  _id: string
  name: string
  description: string
  portalType: RolePortalType
  permissions: import("@/lib/permissions").PermissionsShape
}
export type HelpdeskCategoryOption = { _id: string; name: string }
export type HelpdeskPriorityOption = {
  _id: string
  name: string
  color: string
  slaResponseMinutes: number
  slaResolutionMinutes: number
}
export type AssetOption = { _id: string; assetId: string; name: string }
export type CustomFieldModule = "assets" | "licenses" | "helpdesk" | "vendors"
export type CustomFieldType = "text" | "number" | "date" | "select" | "checkbox"
export type CustomFieldDefinitionOption = {
  _id: string
  module: CustomFieldModule
  label: string
  key: string
  type: CustomFieldType
  options: string[]
  required: boolean
  order: number
  status: "Active" | "Inactive"
}

export function useAssetCategoryOptions() {
  return useLookup<AssetCategoryOption>("/asset-categories")
}
export function useAssetOptions() {
  return useLookupWithoutStatusFilter<AssetOption>("/assets")
}
export function useLicenseCategoryOptions() {
  return useLookup<LicenseCategoryOption>("/license-categories")
}
export function useVendorOptions() {
  return useLookup<VendorOption>("/vendors")
}
export function useLocationOptions() {
  return useLookup<LocationOption>("/locations")
}
export function useDepartmentOptions() {
  return useLookup<DepartmentOption>("/departments")
}
export function useDesignationOptions() {
  return useLookup<DesignationOption>("/designations")
}
export function useHelpdeskCategoryOptions() {
  return useLookup<HelpdeskCategoryOption>("/helpdesk-categories")
}
export function useHelpdeskPriorityOptions() {
  return useLookup<HelpdeskPriorityOption>("/helpdesk-priorities")
}

/** Active custom field definitions for one module, sorted by their configured `order` - powers
 * <CustomFieldsSection>. Same "fail quiet, empty list" shape as every other lookup hook here (a
 * form without any custom fields defined should render unchanged, not show an error).
 *
 * `categoryId`, module "assets" only: when provided, only definitions APPLICABLE to that Asset
 * Type are returned (org-wide definitions plus that category's own scoped ones - see the
 * backend's `applicableToCategory` query param) - a category-scoped field like "UPS Capacity"
 * must never appear on a Laptop's form. Omitted/blank (e.g. no category chosen yet) returns every
 * org-wide definition only, so the form still renders sensibly before a category is picked. */
export function useCustomFieldDefinitionOptions(module: CustomFieldModule, categoryId?: string) {
  const [items, setItems] = React.useState<CustomFieldDefinitionOption[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setLoading(true)
    apiClient
      .get<ApiEnvelope<Paginated<CustomFieldDefinitionOption>>>("/custom-field-definitions", {
        params: {
          module,
          status: "Active",
          limit: 100,
          // No category chosen yet -> `category: ""` (exact-match filter, org-wide definitions
          // only). A category chosen -> `applicableToCategory` (org-wide + that category's own).
          // These two params are mutually exclusive server-side - never send both.
          ...(module === "assets" ? (categoryId ? { applicableToCategory: categoryId } : { category: "" }) : {}),
        },
      })
      .then((res) => setItems([...res.data.data.items].sort((a, b) => a.order - b.order)))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [module, categoryId])

  return { items, loading }
}

/** Active saved Role templates, optionally narrowed to one portal tier - powers the "Apply a
 * saved role" picker on the user create/edit-permissions dialogs (which only makes sense for
 * whichever tier is currently being configured) and the Users list's bulk-apply flow (which
 * passes no portalType, since bulk-apply can target either tier at once). Same
 * `.catch(() => setItems([]))` fail-quiet shape as useCustomFieldDefinitionOptions above - a
 * missing/erroring Roles endpoint should never break the surrounding form. */
export function useRoleOptions(portalType?: RolePortalType) {
  const [items, setItems] = React.useState<RoleOption[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    setLoading(true)
    apiClient
      .get<ApiEnvelope<Paginated<RoleOption>>>("/roles", {
        params: { portalType, status: "Active", limit: 100 },
      })
      .then((res) => setItems(res.data.data.items))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [portalType])

  return { items, loading }
}

export function useUserOptions() {
  const [items, setItems] = React.useState<UserOption[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    apiClient
      .get<ApiEnvelope<UserOption[]>>("/users/lookup")
      .then((res) => setItems(res.data.data))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [])

  return { items, loading }
}
