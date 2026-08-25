"use client"

import * as React from "react"
import { publicLogoUrl } from "@/lib/api-client"
import { useBranding } from "@/lib/branding-context"

const FALLBACK_TEXT = "Admin Portal"

export function AppLogo({
  imgClassName = "h-8 max-w-32 object-contain",
  textClassName = "text-sm font-semibold tracking-tight",
  showTeamNameWithLogo = true,
}: {
  imgClassName?: string
  textClassName?: string
  /** When a logo image is showing, also show the team name text beside it (if one is set). */
  showTeamNameWithLogo?: boolean
}) {
  const { branding } = useBranding()
  const [hasLogo, setHasLogo] = React.useState<boolean | null>(null)
  const logoUrl = publicLogoUrl()

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

  if (hasLogo) {
    return (
      <span className="flex items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoUrl} alt="Logo" className={imgClassName} />
        {showTeamNameWithLogo && branding.teamName && <span className={textClassName}>{branding.teamName}</span>}
      </span>
    )
  }

  return <span className={textClassName}>{branding.teamName || FALLBACK_TEXT}</span>
}
