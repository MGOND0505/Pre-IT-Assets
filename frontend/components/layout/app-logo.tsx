"use client"

import * as React from "react"
import { publicLogoUrl } from "@/lib/api-client"
import { useBranding } from "@/lib/branding-context"
import { useAuth } from "@/lib/auth-context"

const ADMIN_FALLBACK_TEXT = "Admin Portal"
const EMPLOYEE_FALLBACK_TEXT = "Employee Portal"

export function AppLogo({
  imgClassName = "h-8 max-w-32 object-contain",
  textClassName = "text-sm font-semibold tracking-tight",
  showTeamNameWithLogo = true,
  forcePortal,
}: {
  imgClassName?: string
  textClassName?: string
  /** When a logo image is showing, also show the team name text beside it (if one is set). */
  showTeamNameWithLogo?: boolean
  /** Overrides the role-derived fallback label - for a context that already knows which portal
   * it is (e.g. the dedicated /{org}/employee-login page) without waiting on `useAuth()`'s user,
   * which is always null pre-login. Ignored once a real logged-in user's own role is known. */
  forcePortal?: "admin" | "employee"
}) {
  const { branding } = useBranding()
  const { user } = useAuth()
  const [hasLogo, setHasLogo] = React.useState<boolean | null>(null)
  const logoUrl = publicLogoUrl()
  const isEmployeePortal = user ? user.employeeTier === "employee" : forcePortal === "employee"
  const fallbackText = isEmployeePortal ? EMPLOYEE_FALLBACK_TEXT : ADMIN_FALLBACK_TEXT

  React.useEffect(() => {
    if (!logoUrl) {
      setHasLogo(false)
      return
    }
    let cancelled = false
    const probe = new window.Image()
    probe.onload = () => {
      if (!cancelled) setHasLogo(true)
    }
    probe.onerror = () => {
      if (!cancelled) setHasLogo(false)
    }
    probe.src = logoUrl
    return () => {
      cancelled = true
    }
  }, [logoUrl])

  {/* hasLogo can still be stale-true for one render right after logoUrl itself changes to null
     (e.g. navigating from an org-scoped page into the Super Admin panel, which has no org in the
     URL at all) - state updates commit before the effect that would reset it runs. Requiring
     logoUrl here too, not just hasLogo, makes that transitional render safe as well. */}
  if (hasLogo && logoUrl) {
    return (
      <span className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="Logo" className={imgClassName} />
        {showTeamNameWithLogo && branding.teamName && <span className={textClassName}>{branding.teamName}</span>}
      </span>
    )
  }

  return <span className={textClassName}>{branding.teamName || fallbackText}</span>
}
