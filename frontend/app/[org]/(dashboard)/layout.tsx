"use client"

import * as React from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { Info } from "lucide-react"

import { Sidebar } from "@/components/layout/sidebar"
import { Topbar } from "@/components/layout/topbar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AiAssistant } from "@/components/ai/ai-assistant"
import { CommandPalette } from "@/components/ai/command-palette"
import { CursorGlow } from "@/components/ai/cursor-glow"
import { FullPageLoader } from "@/components/layout/full-page-loader"
import { useAuth } from "@/lib/auth-context"
import { useBranding } from "@/lib/branding-context"
import { isValidHexColor } from "@/lib/color-utils"

export default function DashboardLayout({ children }: LayoutProps<"/[org]">) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const params = useParams<{ org: string }>()
  const { branding } = useBranding()
  const mainStyle = isValidHexColor(branding.appBackgroundColor)
    ? { backgroundColor: branding.appBackgroundColor }
    : undefined

  React.useEffect(() => {
    if (!loading && !user) {
      router.replace(`/${params.org}/login?from=${encodeURIComponent(window.location.pathname)}`)
    }
  }, [loading, user, params.org, router])

  // A superAdmin may browse any organization's path; an orgAdmin/teamMember only ever their
  // own; a subSuperAdmin only an org they hold a grant for (auth-context.tsx's org-aware
  // refresh() merges `user.organization` to reflect the CURRENTLY VIEWED org once confirmed -
  // it stays null if they have no grant here). The backend enforces this as the real boundary
  // on every API call (resolveOrganization returns 403/404 for a mismatched/ungranted org) -
  // this is just the client-side UX equivalent, so a wrong-org bookmark bounces back to
  // somewhere valid instead of rendering a dashboard whose every API call would fail.
  const wrongOrg = user && user.role !== "superAdmin" && user.organization?.slug !== params.org
  React.useEffect(() => {
    if (!wrongOrg) return
    // Has a real home/granted org to bounce back to (orgAdmin/teamMember, or a subSuperAdmin
    // viewing a DIFFERENT granted org than this URL). Otherwise (no grant here at all) send
    // them back to their own org picker at "/" rather than doing nothing.
    router.replace(user?.organization ? `/${user.organization.slug}` : "/")
  }, [wrongOrg, user, router])

  if (loading || !user || wrongOrg) return <FullPageLoader />

  return (
    <div className="flex h-dvh min-h-0">
      <div className="hidden w-64 shrink-0 md:block">
        <Sidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Topbar />
        {(user.role === "superAdmin" || user.role === "subSuperAdmin") && (
          <Alert variant="warning" className="rounded-none border-x-0 border-t-0 py-2">
            <Info />
            <AlertDescription className="flex flex-1 items-center justify-between text-foreground">
              <span>
                Viewing as {user.role === "superAdmin" ? "Super Admin" : "Sub-Super Admin"}:{" "}
                <span className="font-medium">{params.org}</span>
              </span>
              <Link href="/" className="text-muted-foreground hover:underline">
                Back to Organizations
              </Link>
            </AlertDescription>
          </Alert>
        )}
        <main className="flex-1 overflow-y-auto bg-muted/30" style={mainStyle}>
          <div className="mx-auto w-full max-w-[1600px] p-6 lg:px-8 lg:py-7">{children}</div>
        </main>
      </div>

      <CommandPalette />
      <AiAssistant />
      <CursorGlow />
    </div>
  )
}
