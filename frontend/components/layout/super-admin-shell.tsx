"use client"

import * as React from "react"
import Link from "next/link"
import { ChevronDown } from "lucide-react"

import { AppLogo } from "@/components/layout/app-logo"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { UserMenu } from "@/components/layout/user-menu"
import { useAuth } from "@/lib/auth-context"

/** Flat top-bar shell for the Super Admin's own pages (Organizations, Sub-Super Admins) - no
 * sidebar, matching the reference design. Not used for subSuperAdmin, orgAdmin, or teamMember -
 * each of those keeps its own existing chrome. */
export function SuperAdminShell({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <header className="flex h-16 shrink-0 items-center gap-4 border-b bg-background px-6 shadow-soft-sm">
        <AppLogo imgClassName="h-8 max-w-40 object-contain" textClassName="text-base font-semibold tracking-tight" />
        <div className="flex-1" />
        {user && (
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {user.name} · Super Admin
          </span>
        )}
        <Link
          href="/sub-super-admins"
          className="flex items-center gap-1.5 rounded-lg border bg-background px-3 py-1.5 text-sm shadow-soft-sm transition-colors duration-150 hover:bg-muted"
        >
          Sub-Super Admins
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Link>
        <ThemeToggle />
        <UserMenu />
      </header>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1600px] p-6 lg:px-8 lg:py-7">{children}</div>
      </main>
    </div>
  )
}
