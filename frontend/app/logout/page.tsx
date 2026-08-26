"use client"

import * as React from "react"
import { useAuth } from "@/lib/auth-context"

export default function LogoutPage() {
  const { logout } = useAuth()

  React.useEffect(() => {
    logout()
  }, [logout])

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-2 bg-muted/30 p-4">
      <p className="text-sm text-muted-foreground">Signing out...</p>
    </div>
  )
}
