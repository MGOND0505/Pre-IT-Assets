"use client"

import * as React from "react"
import { apiClient, type ApiEnvelope } from "@/lib/api-client"

export type CatalogPermission = {
  _id: string
  module: string
  action: string
  key: string
  description: string
}

const ACTION_ORDER = ["read", "create", "write", "delete", "assign", "transfer", "retire", "key_reveal", "manage_users"]

export function usePermissionCatalog() {
  const [permissions, setPermissions] = React.useState<CatalogPermission[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    apiClient
      .get<ApiEnvelope<CatalogPermission[]>>("/permissions")
      .then((res) => setPermissions(res.data.data))
      .finally(() => setLoading(false))
  }, [])

  const modules = React.useMemo(() => {
    const moduleOrder: string[] = []
    const byModule = new Map<string, CatalogPermission[]>()

    for (const permission of permissions) {
      if (!byModule.has(permission.module)) {
        byModule.set(permission.module, [])
        moduleOrder.push(permission.module)
      }
      byModule.get(permission.module)!.push(permission)
    }

    return moduleOrder.map((module) => ({
      module,
      permissions: byModule
        .get(module)!
        .sort((a, b) => ACTION_ORDER.indexOf(a.action) - ACTION_ORDER.indexOf(b.action)),
    }))
  }, [permissions])

  return { permissions, modules, loading }
}

export { ACTION_ORDER }
