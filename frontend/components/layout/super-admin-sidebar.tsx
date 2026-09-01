"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { LayoutDashboard, UserCog, Building2, Search, Users, ShieldAlert, Activity } from "lucide-react"
import { toast } from "sonner"

import { AppLogo } from "@/components/layout/app-logo"
import { ScrollArea } from "@/components/ui/scroll-area"
import { AiAssistantSidebarCard } from "@/components/ai/ai-assistant-sidebar-card"
import { OPEN_SUPER_ADMIN_AI_ASSISTANT_EVENT } from "@/lib/ai-assistant-events"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { cn } from "@/lib/utils"

const NAV_LINKS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/", label: "Organizations", icon: Building2 },
  { href: "/sub-super-admins", label: "Sub-Super Admins", icon: UserCog },
  { href: "/users", label: "Users", icon: Users },
  { href: "/security-settings", label: "Security Settings", icon: ShieldAlert },
  { href: "/system-monitoring", label: "System Monitoring", icon: Activity },
]

type OrgListItem = { _id: string; name: string; slug: string; status: "Active" | "Inactive" }

/**
 * The Super Admin panel's left sidebar - real top-level nav plus a live list of every
 * organization, fetched fresh whenever this mounts (i.e. every time a Super Admin page loads),
 * so a just-created organization shows up here the moment they're back in this shell - no stale
 * cache to bust, since there isn't one.
 */
export function SuperAdminSidebar() {
  const pathname = usePathname()
  const [orgs, setOrgs] = React.useState<OrgListItem[]>([])
  const [loading, setLoading] = React.useState(true)
  const [filter, setFilter] = React.useState("")

  React.useEffect(() => {
    let cancelled = false
    apiClient
      .get<ApiEnvelope<{ items: OrgListItem[] }>>("/organizations", { params: { limit: 500 } })
      .then((res) => {
        if (!cancelled) setOrgs(res.data.data.items)
      })
      .catch((err) => {
        if (!cancelled) {
          setOrgs([])
          toast.error(apiErrorMessage(err, "Could not load organizations"))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const filteredOrgs = filter.trim()
    ? orgs.filter((o) => o.name.toLowerCase().includes(filter.trim().toLowerCase()))
    : orgs

  return (
    <div className="relative z-10 flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground shadow-soft-sm">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-sidebar-border px-4">
        <AppLogo textClassName="text-sm font-semibold tracking-tight text-sidebar-foreground" />
      </div>

      <div className="flex flex-col gap-1 px-3 py-3">
        {NAV_LINKS.map((link) => {
          const active = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <link.icon className="size-4 shrink-0" />
              {link.label}
            </Link>
          )
        })}
      </div>

      <div className="flex items-center justify-between border-t border-sidebar-border px-4 pt-3 pb-2">
        <span className="text-xs font-semibold tracking-wide text-sidebar-foreground/60 uppercase">
          Organizations {!loading && `(${orgs.length})`}
        </span>
      </div>

      {orgs.length > 6 && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-2 rounded-lg border border-sidebar-border bg-sidebar-accent/40 px-2.5 py-1.5">
            <Search className="size-3.5 shrink-0 text-sidebar-foreground/50" />
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter..."
              className="w-full bg-transparent text-xs text-sidebar-foreground placeholder:text-sidebar-foreground/40 outline-none"
            />
          </div>
        </div>
      )}

      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-0.5 px-3 pb-4">
          {loading ? (
            <p className="px-3 py-2 text-xs text-sidebar-foreground/50">Loading...</p>
          ) : filteredOrgs.length === 0 ? (
            <p className="px-3 py-2 text-xs text-sidebar-foreground/50">
              {orgs.length === 0 ? "No organizations yet." : "No matches."}
            </p>
          ) : (
            filteredOrgs.map((org) => {
              const active = pathname === `/${org.slug}` || pathname?.startsWith(`/${org.slug}/`)
              return (
                <Link
                  key={org._id}
                  href={`/${org.slug}/organization`}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors duration-150",
                    active
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <span
                    className={cn("size-1.5 shrink-0 rounded-full", org.status === "Active" ? "bg-success" : "bg-sidebar-foreground/30")}
                    aria-hidden
                  />
                  <span className="truncate">{org.name}</span>
                </Link>
              )
            })
          )}
        </div>
      </ScrollArea>
      <AiAssistantSidebarCard
        eventName={OPEN_SUPER_ADMIN_AI_ASSISTANT_EVENT}
        description="Ask anything about organizations, users, assets, and tickets - across your whole system."
      />
    </div>
  )
}
