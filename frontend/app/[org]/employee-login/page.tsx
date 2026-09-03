"use client"

import * as React from "react"
import { Suspense } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginForm } from "@/components/auth/login-form"
import { AppLogo } from "@/components/layout/app-logo"
import { AuthBackground } from "@/components/layout/auth-background"
import { useBranding } from "@/lib/branding-context"

/** A dedicated login entry point for Employee accounts, distinct from the regular
 * /{orgSlug}/login (Admin/Sub Admin/Employee alike) - handed out specifically to employees.
 * Enforced server-side (auth.service.ts#login rejects any non-Employee-tier account here, even
 * with a correct password), not just a label - see the portal prop on LoginForm below. */
export default function EmployeeLoginPage() {
  const params = useParams<{ org: string }>()
  const { branding } = useBranding()

  React.useEffect(() => {
    document.title = branding.teamName || "Employee Portal"
  }, [branding.teamName])

  return (
    <AuthBackground>
      <AppLogo imgClassName="h-14 max-w-56 object-contain" textClassName="text-lg font-semibold tracking-tight" />
      <Card className="w-full max-w-sm shadow-soft-lg">
        <CardHeader>
          <CardTitle>Employee Portal</CardTitle>
          <CardDescription>Sign in to view your assets, tickets, and tasks.</CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense>
            <LoginForm orgSlug={params.org} portal="employee" />
          </Suspense>
        </CardContent>
      </Card>
    </AuthBackground>
  )
}
