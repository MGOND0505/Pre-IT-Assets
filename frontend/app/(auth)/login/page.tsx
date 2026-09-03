import { Suspense } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LoginForm } from "@/components/auth/login-form"
import { AppLogo } from "@/components/layout/app-logo"
import { AuthBackground } from "@/components/layout/auth-background"

export default function LoginPage() {
  return (
    <AuthBackground showDeveloperCreditIcon={false} developerCreditVariant="light">
      <AppLogo imgClassName="h-14 max-w-56 object-contain" textClassName="text-lg font-semibold tracking-tight" />
      <Card className="w-full max-w-sm shadow-soft-lg">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense>
            <LoginForm />
          </Suspense>
        </CardContent>
      </Card>
    </AuthBackground>
  )
}
