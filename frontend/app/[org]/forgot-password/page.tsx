"use client"

import { useParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ForgotPasswordForm } from "@/components/auth/forgot-password-form"
import { AppLogo } from "@/components/layout/app-logo"
import { AuthBackground } from "@/components/layout/auth-background"

export default function OrgForgotPasswordPage() {
  const params = useParams<{ org: string }>()

  return (
    <AuthBackground>
      <div className="lg:hidden">
        <AppLogo imgClassName="h-12 max-w-56 object-contain" textClassName="text-lg font-semibold tracking-tight" />
      </div>
      <Card className="w-full max-w-sm shadow-soft-lg">
        <CardHeader>
          <CardTitle>Forgot password</CardTitle>
          <CardDescription>We&apos;ll email you a link to reset it.</CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm orgSlug={params.org} />
        </CardContent>
      </Card>
    </AuthBackground>
  )
}
