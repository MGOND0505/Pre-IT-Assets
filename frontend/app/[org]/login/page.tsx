"use client"

import { Suspense } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginForm } from "@/components/auth/login-form"
import { AppLogo } from "@/components/layout/app-logo"
import { AuthBackground } from "@/components/layout/auth-background"

export default function OrgLoginPage() {
  const params = useParams<{ org: string }>()

  return (
    <AuthBackground>
      <div className="lg:hidden">
        <AppLogo imgClassName="h-12 max-w-56 object-contain" textClassName="text-lg font-semibold tracking-tight" />
      </div>
      {/* Desktop-only counterpart to the mobile block above - a per-org custom logo (uploaded via
          Super Admin/Sub-Super Admin panel) shows here; renders nothing when none is set. */}
      <div className="hidden lg:flex">
        <AppLogo hideWhenNoLogo imgClassName="h-14 max-w-56 object-contain" textClassName="text-lg font-semibold tracking-tight" />
      </div>
      <Card className="w-full max-w-sm shadow-soft-lg">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense>
            <LoginForm orgSlug={params.org} />
          </Suspense>
        </CardContent>
      </Card>
    </AuthBackground>
  )
}
