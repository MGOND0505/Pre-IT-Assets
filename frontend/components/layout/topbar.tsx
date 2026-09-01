"use client"

import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Sidebar } from "@/components/layout/sidebar"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { NotificationBell } from "@/components/layout/notification-bell"
import { UserMenu } from "@/components/layout/user-menu"
import { CommandPaletteTrigger } from "@/components/ai/command-palette"
import { useBranding } from "@/lib/branding-context"
import { isValidHexColor, surfaceOverrideVars } from "@/lib/color-utils"

export function Topbar() {
  const { branding } = useBranding()
  const style = isValidHexColor(branding.sidebarColor) ? surfaceOverrideVars(branding.sidebarColor, "--background") : undefined

  return (
    <header
      className="relative z-10 flex h-14 items-center gap-2 border-b bg-background text-foreground px-4 shadow-soft-sm"
      style={style}
    >
      <Sheet>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
              <Menu className="size-5" />
            </Button>
          }
        />
        <SheetContent side="left" className="w-72 p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <Sidebar />
        </SheetContent>
      </Sheet>

      <div className="hidden md:block">
        <CommandPaletteTrigger />
      </div>
      <div className="flex-1" />
      <ThemeToggle />
      <NotificationBell />
      <UserMenu />
    </header>
  )
}
