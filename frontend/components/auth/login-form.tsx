"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { MagneticButton } from "@/components/ui/magnetic-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TurnstileWidget } from "@/components/auth/turnstile-widget"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { useBranding } from "@/lib/branding-context"

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
})

type LoginValues = z.infer<typeof loginSchema>

export function LoginForm({ orgSlug, portal }: { orgSlug?: string; portal?: "employee" } = {}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { refresh } = useAuth()
  const { branding } = useBranding()
  // CAPTCHA is required on every login attempt, org-scoped or flat, with no per-org opt-out
  // (see auth.service.ts#resolveLoginCaptchaStatus) - unlike forgot-password-form.tsx, which
  // still follows each org's own configurable captchaEnabled toggle. Org-scoped login sources
  // its site key from /public/branding's unconditional loginCaptchaSiteKey field; the flat login
  // (superAdmin/subSuperAdmin - no org to hold that response) has no per-org home for this, so it
  // fetches from a small flat, unauthenticated endpoint instead.
  const [flatCaptchaSiteKey, setFlatCaptchaSiteKey] = React.useState<string | null>(null)
  React.useEffect(() => {
    if (orgSlug) return
    apiClient
      .get<ApiEnvelope<{ captchaSiteKey: string | null }>>("/public/captcha-config")
      .then((res) => setFlatCaptchaSiteKey(res.data.data.captchaSiteKey))
      .catch(() => setFlatCaptchaSiteKey(null))
  }, [orgSlug])

  const captchaSiteKey = orgSlug ? branding.loginCaptchaSiteKey : flatCaptchaSiteKey
  const captchaRequired = Boolean(captchaSiteKey)
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginValues) {
    setSubmitting(true)
    try {
      const res = await apiClient.post<ApiEnvelope<{ passwordExpiryWarning: { daysRemaining: number } | null }>>(
        "/auth/login",
        { ...values, orgSlug, captchaToken: captchaToken ?? undefined, portal }
      )
      await refresh()
      const warning = res.data.data.passwordExpiryWarning
      if (warning) {
        toast.warning(
          `Your password expires in ${warning.daysRemaining} day${warning.daysRemaining === 1 ? "" : "s"} - change it soon.`
        )
      }
      // "from" comes straight from the URL's own query string - never trust it as an absolute
      // redirect target (open-redirect risk: a phishing link could smuggle in a full external
      // URL, and it'd fire right after a real, convincing login). Only accept it if it's a
      // same-origin relative path - "/something", never "//something" (protocol-relative) or an
      // absolute "http(s)://" URL.
      const from = searchParams.get("from")
      const isSafeRelativePath = from ? from.startsWith("/") && !from.startsWith("//") : false
      const redirectTo = isSafeRelativePath ? from! : orgSlug ? `/${orgSlug}` : "/"
      router.replace(redirectTo)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Login failed"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="you@company.com" {...register("email")} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Password</Label>
          <Link
            href={orgSlug ? `/${orgSlug}/forgot-password` : "/forgot-password"}
            className="text-xs text-muted-foreground hover:underline"
          >
            Forgot password?
          </Link>
        </div>
        <Input id="password" type="password" {...register("password")} />
        {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
      </div>
      {captchaRequired && <TurnstileWidget siteKey={captchaSiteKey!} onToken={setCaptchaToken} />}
      <MagneticButton className="w-full">
        <Button type="submit" className="w-full" disabled={submitting || (captchaRequired && !captchaToken)}>
          {submitting ? "Signing in..." : "Sign in"}
        </Button>
      </MagneticButton>
    </form>
  )
}
