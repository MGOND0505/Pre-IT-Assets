"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { SidebarNav } from "@/components/layout/sidebar-nav"
import { AvyntorCredit } from "@/components/layout/avyntor-credit"
import { useBranding } from "@/lib/branding-context"
import { isValidHexColor, sidebarOverrideVars } from "@/lib/color-utils"
import { publicLogoUrl } from "@/lib/api-client"

export function Sidebar() {
  const { branding } = useBranding()
  const style = isValidHexColor(branding.sidebarColor) ? sidebarOverrideVars(branding.sidebarColor) : undefined

  return (
    <div
      className="relative z-10 flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-soft-sm"
      style={style}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
        {branding.hasLogo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={publicLogoUrl() ?? undefined} alt="Logo" className="h-8 max-w-32 object-contain" />
        )}
        {branding.teamName && (
          <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">{branding.teamName}</span>
        )}
      </div>
      <ScrollArea className="min-h-0 flex-1">
        <SidebarNav />
      </ScrollArea>
      <div className="flex shrink-0 items-center justify-center border-t border-sidebar-border px-4 py-3">
        <AvyntorCredit variant="sidebar" />
      </div>
    </div>
  )
}
