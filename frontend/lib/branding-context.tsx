"use client"

import * as React from "react"
import { apiClient, type ApiEnvelope } from "@/lib/api-client"
import { BASELINE_POLICY, type PasswordPolicy } from "@/lib/password-policy"

export type Branding = {
  teamName: string
  hasLogo: boolean
  sidebarColor: string
  appBackgroundColor: string
  passwordPolicy: PasswordPolicy
  // Unconditional whenever the server has Turnstile configured - login requires CAPTCHA on
  // every attempt, with no per-org opt-out. See login-form.tsx.
  loginCaptchaSiteKey: string | null
  // The org's own configurable toggle - used only by forgot-password-form.tsx.
  captchaEnabled: boolean
  captchaSiteKey: string | null
}

const DEFAULT_BRANDING: Branding = {
  teamName: "",
  hasLogo: false,
  sidebarColor: "",
  appBackgroundColor: "",
  passwordPolicy: BASELINE_POLICY,
  loginCaptchaSiteKey: null,
  captchaEnabled: false,
  captchaSiteKey: null,
}

type BrandingContextValue = {
  branding: Branding
  loading: boolean
  refresh: () => Promise<void>
}

const BrandingContext = React.createContext<BrandingContextValue | undefined>(undefined)

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const [branding, setBranding] = React.useState<Branding>(DEFAULT_BRANDING)
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    try {
      const res = await apiClient.get<ApiEnvelope<Branding>>("/public/branding")
      setBranding(res.data.data)
    } catch {
      setBranding(DEFAULT_BRANDING)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    refresh()
  }, [refresh])

  return <BrandingContext.Provider value={{ branding, loading, refresh }}>{children}</BrandingContext.Provider>
}

export function useBranding(): BrandingContextValue {
  const ctx = React.useContext(BrandingContext)
  if (!ctx) throw new Error("useBranding must be used within a BrandingProvider")
  return ctx
}
