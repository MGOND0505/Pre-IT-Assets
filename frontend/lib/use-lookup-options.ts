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
      .finally(() => setLoading(false))
  }, [endpoint, limit])

  return { items, loading }
}

export type AssetCategoryOption = { _id: string; name: string; prefix: string }
export type VendorOption = { _id: string; name: string }
export type LocationOption = { _id: string; name: string }
export type DepartmentOption = { _id: string; name: string }
export type UserOption = { _id: string; name: string; email: string }

export function useAssetCategoryOptions() {
  return useLookup<AssetCategoryOption>("/asset-categories")
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

export function useUserOptions() {
  const [items, setItems] = React.useState<UserOption[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    apiClient
      .get<ApiEnvelope<UserOption[]>>("/users/lookup")
      .then((res) => setItems(res.data.data))
      .finally(() => setLoading(false))
  }, [])

  return { items, loading }
}
