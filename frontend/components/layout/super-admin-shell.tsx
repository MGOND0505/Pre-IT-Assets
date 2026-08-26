"use client"

import * as React from "react"
import { Menu } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { UserMenu } from "@/components/layout/user-menu"
import { SuperAdminSearch } from "@/components/layout/super-admin-search"
import { SuperAdminSidebar } from "@/components/layout/super-admin-sidebar"
import { SuperAdminAiAssistant } from "@/components/ai/super-admin-ai-assistant"
import { useAuth } from "@/lib/auth-context"

/** Sidebar shell for the Super Admin's own pages (Dashboard, Organizations, Sub-Super Admins) -
 * the sidebar carries top-level nav plus a live organization list (see SuperAdminSidebar). Not
 * used for subSuperAdmin, orgAdmin, or teamMember - each of those keeps its own existing chrome. */
export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  return (
    <div className="flex h-dvh min-h-0">
      <div className="hidden w-64 shrink-0 md:block">
        <SuperAdminSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background px-6 shadow-soft-sm">
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
              <SuperAdminSidebar />
            </SheetContent>
          </Sheet>
          <div className="hidden flex-1 justify-center lg:flex">
            <SuperAdminSearch />
          </div>
          <div className="flex-1 lg:hidden" />
          {user && <span className="hidden text-sm text-muted-foreground sm:inline">{user.name} · Super Admin</span>}
          <ThemeToggle />
          <UserMenu />
        </header>
        <main className="flex-1 overflow-y-auto bg-muted/30">
          <div className="mx-auto w-full max-w-[1600px] p-6 lg:px-8 lg:py-7">{children}</div>
        </main>
      </div>
      <SuperAdminAiAssistant />
    </div>
  )
}
