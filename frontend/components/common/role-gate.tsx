"use client"

import type { ReactNode } from "react"
import { useAuth } from "@/lib/auth-context"
import { hasPermission, type PermissionKey } from "@/lib/permissions"

export function RoleGate({
  permission,
  fallback = null,
  children,
}: {
  permission: PermissionKey
  fallback?: ReactNode
  children: ReactNode
}) {
  const { user } = useAuth()

  if (!hasPermission(user, permission)) {
    return fallback
  }

  return children
}
