"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SuperAdminShell } from "@/components/layout/super-admin-shell"
import { FullPageLoader } from "@/components/layout/full-page-loader"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"

type NumField = number | null

type EffectiveSettings = {
  authRateLimitWindowMs: number
  authRateLimitMax: number
  apiRateLimitWindowMs: number
  apiRateLimitMax: number
  loginLockoutThreshold: number
  loginLockoutDurationMinutes: number
  turnstileSiteKey: string
  turnstileSecretKey: string
}

type PlatformSettings = {
  authRateLimitWindowMs: NumField
  authRateLimitMax: NumField
  apiRateLimitWindowMs: NumField
  apiRateLimitMax: NumField
  loginLockoutThreshold: NumField
  loginLockoutDurationMinutes: NumField
  turnstileSiteKey: string
  turnstileSecretKey: string
  effective: EffectiveSettings
}

/** Text input bound to a nullable number field - blank means "not overridden, use the .env
 * default" (see PlatformSettings.ts). Shows the currently-effective value as a placeholder so an
 * admin can see what's active before overriding it. */
function NullableNumberField({
  id,
  label,
  value,
  effectiveValue,
  helperText,
  onChange,
}: {
  id: string
  label: string
  value: NumField
  effectiveValue: number
  helperText?: string
  onChange: (value: NumField) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min={1}
        value={value ?? ""}
        placeholder={String(effectiveValue)}
        onChange={(e) => {
          const raw = e.target.value
          onChange(raw === "" ? null : Number(raw))
        }}
      />
      {helperText && <p className="text-xs text-muted-foreground">{helperText}</p>}
    </div>
  )
}

/**
 * Phase 9's "Global / Security Settings" - a flat, Super Admin-only page for the deliberately
 * limited, safe subset of operational config that otherwise only lives in .env with no admin UI:
 * rate-limit thresholds, login lockout threshold/duration, and the shared Cloudflare Turnstile
 * (CAPTCHA) key pair. True deploy-time secrets (JWT_SECRET, MONGODB_URI, mail/Metabase
 * credentials, etc.) stay .env-only and have no presence here - see
 * backend/src/models/PlatformSettings.ts. Follows the same auth-guard/shell pattern as Phase 8's
 * /users page.
 */
export default function SecuritySettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [settings, setSettings] = React.useState<PlatformSettings | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace("/login")
      return
    }
    if (user.role !== "superAdmin") {
      router.replace(user.organization ? `/${user.organization.slug}` : "/")
    }
  }, [authLoading, user, router])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<PlatformSettings>>("/platform-settings")
      setSettings(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load security settings"))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (user?.role === "superAdmin") load()
  }, [user, load])

  async function handleSave() {
    if (!settings) return
    setSubmitting(true)
    try {
      const res = await apiClient.put<ApiEnvelope<PlatformSettings>>("/platform-settings", {
        authRateLimitWindowMs: settings.authRateLimitWindowMs,
        authRateLimitMax: settings.authRateLimitMax,
        apiRateLimitWindowMs: settings.apiRateLimitWindowMs,
        apiRateLimitMax: settings.apiRateLimitMax,
        loginLockoutThreshold: settings.loginLockoutThreshold,
        loginLockoutDurationMinutes: settings.loginLockoutDurationMinutes,
        turnstileSiteKey: settings.turnstileSiteKey,
        turnstileSecretKey: settings.turnstileSecretKey,
      })
      // The PUT response doesn't carry `effective` (see platformSettings.controller.ts) - reload
      // to pick up the freshly recomputed effective values for the placeholders.
      setSettings((prev) => (prev ? { ...res.data.data, effective: prev.effective } : prev))
      toast.success("Security settings saved")
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save security settings"))
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || !user || user.role !== "superAdmin") return <FullPageLoader />
  if (loading || !settings) {
    return (
      <SuperAdminShell>
        <FullPageLoader />
      </SuperAdminShell>
    )
  }

  return (
    <SuperAdminShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Security Settings</h1>
          <p className="text-sm text-muted-foreground">
            Platform-wide operational config that otherwise only lives in the server&apos;s .env file. Leave a field
            blank to revert to its server default (shown as the field&apos;s placeholder).
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Rate Limiting</CardTitle>
            <CardDescription>
              Applies to every request across the whole platform. The &quot;max requests&quot; fields take effect
              immediately, with no server restart required. The &quot;window&quot; fields are stored for reference but
              only take effect after the next server restart.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NullableNumberField
              id="auth-window"
              label="Auth rate limit window (ms)"
              value={settings.authRateLimitWindowMs}
              effectiveValue={settings.effective.authRateLimitWindowMs}
              helperText="Takes effect after the next server restart."
              onChange={(v) => setSettings({ ...settings, authRateLimitWindowMs: v })}
            />
            <NullableNumberField
              id="auth-max"
              label="Auth rate limit max requests"
              value={settings.authRateLimitMax}
              effectiveValue={settings.effective.authRateLimitMax}
              helperText="Live - applies immediately, no restart needed."
              onChange={(v) => setSettings({ ...settings, authRateLimitMax: v })}
            />
            <NullableNumberField
              id="api-window"
              label="API rate limit window (ms)"
              value={settings.apiRateLimitWindowMs}
              effectiveValue={settings.effective.apiRateLimitWindowMs}
              helperText="Takes effect after the next server restart."
              onChange={(v) => setSettings({ ...settings, apiRateLimitWindowMs: v })}
            />
            <NullableNumberField
              id="api-max"
              label="API rate limit max requests"
              value={settings.apiRateLimitMax}
              effectiveValue={settings.effective.apiRateLimitMax}
              helperText="Live - applies immediately, no restart needed."
              onChange={(v) => setSettings({ ...settings, apiRateLimitMax: v })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Login Lockout</CardTitle>
            <CardDescription>How many failed login attempts lock an account, and for how long. Live - applies immediately.</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <NullableNumberField
              id="lockout-threshold"
              label="Failed attempts before lockout"
              value={settings.loginLockoutThreshold}
              effectiveValue={settings.effective.loginLockoutThreshold}
              onChange={(v) => setSettings({ ...settings, loginLockoutThreshold: v })}
            />
            <NullableNumberField
              id="lockout-duration"
              label="Lockout duration (minutes)"
              value={settings.loginLockoutDurationMinutes}
              effectiveValue={settings.effective.loginLockoutDurationMinutes}
              onChange={(v) => setSettings({ ...settings, loginLockoutDurationMinutes: v })}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>CAPTCHA (Cloudflare Turnstile)</CardTitle>
            <CardDescription>
              One shared site/secret key pair for the whole deployment. Leave both blank to fall back to the
              server&apos;s TURNSTILE_SITE_KEY/TURNSTILE_SECRET_KEY env values, if any.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="turnstile-site-key">Site key</Label>
              <Input
                id="turnstile-site-key"
                value={settings.turnstileSiteKey}
                placeholder={settings.effective.turnstileSiteKey || "Not configured"}
                onChange={(e) => setSettings({ ...settings, turnstileSiteKey: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="turnstile-secret-key">Secret key</Label>
              <Input
                id="turnstile-secret-key"
                type="password"
                value={settings.turnstileSecretKey}
                placeholder={settings.effective.turnstileSecretKey ? "Set" : "Not configured"}
                onChange={(e) => setSettings({ ...settings, turnstileSecretKey: e.target.value })}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </SuperAdminShell>
  )
}
