"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from "lucide-react"

import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog"
import { isNavGroup, navConfig, type NavLeaf } from "@/lib/nav-config"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"
import { cn } from "@/lib/utils"

type FlatEntry = { label: string; group?: string; href: string; absolute?: boolean }

/** A real, functional quick-navigation search across every page the current user can actually
 * see - not an AI feature, just a fast Cmd/Ctrl+K launcher in the command-palette style. */
export function CommandPalette() {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const [activeIndex, setActiveIndex] = React.useState(0)
  const router = useRouter()
  const { user } = useAuth()
  const toOrgHref = useOrgHref()
  const inputRef = React.useRef<HTMLInputElement>(null)

  const visibleLeaf = React.useCallback(
    (item: NavLeaf) => {
      if (item.disabled) return false
      if (item.superAdminOnly) return user?.role === "superAdmin"
      if (item.adminOnly && !user?.isAdmin) return false
      if (item.permission && !can(user, item.permission.area, item.permission.action)) return false
      if (item.requiresModule && user?.role !== "superAdmin" && !user?.organization?.enabledModules.includes(item.requiresModule)) {
        return false
      }
      return true
    },
    [user]
  )

  const entries = React.useMemo<FlatEntry[]>(() => {
    const flat: FlatEntry[] = []
    for (const entry of navConfig) {
      if (isNavGroup(entry)) {
        for (const child of entry.children ?? []) {
          if (visibleLeaf(child)) flat.push({ label: child.label, group: entry.label, href: child.href, absolute: child.absolute })
        }
      } else if (visibleLeaf(entry)) {
        flat.push({ label: entry.label, href: entry.href, absolute: entry.absolute })
      }
    }
    return flat
  }, [visibleLeaf])

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => e.label.toLowerCase().includes(q) || e.group?.toLowerCase().includes(q))
  }, [entries, query])

  React.useEffect(() => setActiveIndex(0), [query])

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [])

  function go(entryIndex: number) {
    const entry = filtered[entryIndex]
    if (!entry) return
    const href = entry.absolute ? entry.href : toOrgHref(entry.href)
    router.push(href)
    setOpen(false)
    setQuery("")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) setQuery("")
      }}
    >
      <DialogPortal>
        <DialogOverlay />
        <div
          className="fixed top-24 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 overflow-hidden rounded-xl bg-popover text-popover-foreground shadow-soft-lg ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95"
          role="dialog"
          aria-label="Quick navigation"
        >
          <div className="flex items-center gap-2 border-b px-4">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages..."
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault()
                  setActiveIndex((i) => Math.min(i + 1, filtered.length - 1))
                } else if (e.key === "ArrowUp") {
                  e.preventDefault()
                  setActiveIndex((i) => Math.max(i - 1, 0))
                } else if (e.key === "Enter") {
                  e.preventDefault()
                  go(activeIndex)
                }
              }}
            />
            <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">Esc</kbd>
          </div>

          <div className="max-h-80 overflow-y-auto p-2">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matching pages.</p>
            ) : (
              filtered.map((entry, index) => (
                <button
                  key={`${entry.group ?? ""}-${entry.href}`}
                  type="button"
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => go(index)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150",
                    index === activeIndex ? "bg-accent text-accent-foreground" : "text-foreground"
                  )}
                >
                  <span>{entry.label}</span>
                  {entry.group && <span className="text-xs text-muted-foreground">{entry.group}</span>}
                </button>
              ))
            )}
          </div>

          <div className="flex items-center gap-3 border-t bg-muted/50 px-4 py-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <ArrowUp className="size-3" />
              <ArrowDown className="size-3" /> navigate
            </span>
            <span className="flex items-center gap-1">
              <CornerDownLeft className="size-3" /> open
            </span>
          </div>
        </div>
      </DialogPortal>
    </Dialog>
  )
}

/** The small "Search anything..." trigger shown in the topbar - opens the same palette via the
 * Cmd/Ctrl+K shortcut it already listens for globally. */
export function CommandPaletteTrigger() {
  const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC")

  function open() {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: !isMac, metaKey: isMac }))
  }

  return (
    <button
      type="button"
      onClick={open}
      className="flex items-center gap-2 rounded-lg border bg-background px-3 py-1.5 text-sm text-muted-foreground shadow-soft-sm transition-colors duration-150 hover:bg-muted hover:text-foreground"
    >
      <Search className="size-3.5" />
      <span className="hidden sm:inline">Search anything...</span>
      <kbd className="ml-2 hidden rounded border bg-muted px-1.5 py-0.5 font-mono text-[10px] sm:inline">
        {isMac ? "⌘K" : "Ctrl K"}
      </kbd>
    </button>
  )
}
