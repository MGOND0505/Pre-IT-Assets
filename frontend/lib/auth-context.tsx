"use client"

import * as React from "react"
import { apiClient, type ApiEnvelope } from "@/lib/api-client"

export type CurrentUser = {
  _id: string
  name: string
  email: string
  roles: { id: string; name: string }[]
  permissions: string[]
  isSuperAdmin: boolean
  status: "Active" | "Inactive"
  mustChangePassword: boolean
}

type AuthContextValue = {
  user: CurrentUser | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<CurrentUser | null>(null)
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    try {
      const res = await apiClient.get<ApiEnvelope<CurrentUser>>("/auth/me")
      setUser(res.data.data)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  const logout = React.useCallback(async () => {
    try {
      await apiClient.post("/auth/logout")
    } finally {
      setUser(null)
      window.location.href = "/login"
    }
  }, [])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <AuthContext.Provider value={{ user, loading, refresh, logout }}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
