"use client"

import * as React from "react"
import { apiClient, type ApiEnvelope } from "@/lib/api-client"

export type RoleOption = {
  _id: string
  name: string
  description: string
  isSystem: boolean
  isSuperAdmin: boolean
  userCount: number
  permissions: { _id: string; key: string; module: string; action: string; description: string }[]
}

export function useRoles() {
  const [roles, setRoles] = React.useState<RoleOption[]>([])
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<RoleOption[]>>("/roles")
      setRoles(res.data.data)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  return { roles, loading, reload: load }
}
