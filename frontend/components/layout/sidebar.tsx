"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { SidebarNav } from "@/components/layout/sidebar-nav"
import { AppLogo } from "@/components/layout/app-logo"
import { AvyntorCredit } from "@/components/layout/avyntor-credit"
import { useBranding } from "@/lib/branding-context"
import { isValidHexColor, sidebarOverrideVars } from "@/lib/color-utils"

export function Sidebar() {
  const { branding } = useBranding()
  const style = isValidHexColor(branding.sidebarColor) ? sidebarOverrideVars(branding.sidebarColor) : undefined

  return (
    <div
      className="relative z-10 flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-soft-sm"
      style={style}
    >
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
        <AppLogo textClassName="text-sm font-semibold tracking-tight text-sidebar-foreground" />
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
