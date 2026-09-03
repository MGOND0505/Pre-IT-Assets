"use client"

import { useBranding } from "@/lib/branding-context"

/** The single, platform-wide logo shown across every page - both the Organization dashboard and
 * the Super Admin panel - overriding each organization's own uploaded logo (Administration >
 * Branding / the Super Admin's per-org "Branding" tab). That per-org upload feature itself is
 * untouched (still stored, still servable at GET /:orgSlug/public/logo) - this component just no
 * longer displays it, by explicit request. */
const FALCON_LOGO_SRC = "/falcon-logo.png"

export function AppLogo({
  imgClassName = "h-8 max-w-32 object-contain",
  textClassName = "text-sm font-semibold tracking-tight",
  showTeamNameWithLogo = true,
}: {
  imgClassName?: string
  textClassName?: string
  /** Also show the team name text beside the logo (if one is set for the current org). */
  showTeamNameWithLogo?: boolean
}) {
  const { branding } = useBranding()

  return (
    <span className="flex items-center gap-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={FALCON_LOGO_SRC} alt="Logo" className={imgClassName} />
      {showTeamNameWithLogo && branding.teamName && <span className={textClassName}>{branding.teamName}</span>}
    </span>
  )
}
