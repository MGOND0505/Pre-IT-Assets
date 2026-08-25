import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ResetPasswordForm } from "@/components/auth/reset-password-form"
import { AppLogo } from "@/components/layout/app-logo"
import { AuthBackground } from "@/components/layout/auth-background"

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return (
    <AuthBackground>
      <div className="lg:hidden">
        <AppLogo imgClassName="h-12 max-w-56 object-contain" textClassName="text-lg font-semibold tracking-tight" />
      </div>
      <Card className="w-full max-w-sm shadow-soft-lg">
        <CardHeader>
          <CardTitle>Reset password</CardTitle>
          <CardDescription>Choose a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          <ResetPasswordForm token={token} />
        </CardContent>
      </Card>
    </AuthBackground>
  )
}
