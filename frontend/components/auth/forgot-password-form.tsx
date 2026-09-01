"use client"

import * as React from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { TurnstileWidget } from "@/components/auth/turnstile-widget"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { useBranding } from "@/lib/branding-context"

const schema = z.object({ email: z.string().email("Enter a valid email address") })
type Values = z.infer<typeof schema>

export function ForgotPasswordForm({ orgSlug }: { orgSlug?: string } = {}) {
  const { branding } = useBranding()
  const captchaRequired = Boolean(orgSlug) && branding.captchaEnabled && Boolean(branding.captchaSiteKey)
  const [captchaToken, setCaptchaToken] = React.useState<string | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [sent, setSent] = React.useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Values>({ resolver: zodResolver(schema) })

  async function onSubmit(values: Values) {
    setSubmitting(true)
    try {
      await apiClient.post("/auth/forgot-password", { ...values, orgSlug, captchaToken: captchaToken ?? undefined })
      setSent(true)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Something went wrong"))
    } finally {
      setSubmitting(false)
    }
  }

  if (sent) {
    return (
      <p className="text-sm text-muted-foreground">
        If that email is registered, a reset link has been sent. In this environment (console mail
        provider) the link is logged to the backend server console.
      </p>
    )
  }

  return (
    <form className="flex flex-col gap-4" onSubmit={handleSubmit(onSubmit)}>
      <div className="flex flex-col gap-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" placeholder="you@company.com" {...register("email")} />
        {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
      </div>
      {captchaRequired && <TurnstileWidget siteKey={branding.captchaSiteKey!} onToken={setCaptchaToken} />}
      <Button type="submit" className="w-full" disabled={submitting || (captchaRequired && !captchaToken)}>
        {submitting ? "Sending..." : "Send reset link"}
      </Button>
    </form>
  )
}
