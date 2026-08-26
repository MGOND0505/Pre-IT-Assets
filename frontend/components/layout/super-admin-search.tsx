"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search } from "lucide-react"

import { apiClient, type ApiEnvelope } from "@/lib/api-client"
import { GLOBAL_RESULT_ICON, GLOBAL_RESULT_LABEL, globalResultHref, type GlobalSearchResult } from "@/lib/global-search-results"
import { cn } from "@/lib/utils"

/** Real, live search across every organization's own data (not nav-only) - the Super Admin
 * panel's counterpart to the org-scoped Command Palette, just inline in the top bar instead of
 * a modal, matching where this sits in the reference design. */
export function SuperAdminSearch() {
  const [query, setQuery] = React.useState("")
  const [results, setResults] = React.useState<GlobalSearchResult[]>([])
  const [open, setOpen] = React.useState(false)
  const [searching, setSearching] = React.useState(false)
  const [activeIndex, setActiveIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const router = useRouter()

  React.useEffect(() => {
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.get<ApiEnvelope<GlobalSearchResult[]>>("/organizations/global-search", { params: { q } })
        setResults(res.data.data)
        setActiveIndex(0)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  React.useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    window.addEventListener("mousedown", onClickOutside)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      window.removeEventListener("mousedown", onClickOutside)
    }
  }, [])

  function go(index: number) {
    const result = results[index]
    if (!result) return
    router.push(globalResultHref(result))
    setOpen(false)
    setQuery("")
  }

  const isMac = typeof navigator !== "undefined" && navigator.platform.toUpperCase().includes("MAC")

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2 text-sm transition-colors focus-within:border-ring focus-within:bg-background focus-within:ring-3 focus-within:ring-ring/20">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault()
              setActiveIndex((i) => Math.min(i + 1, results.length - 1))
            } else if (e.key === "ArrowUp") {
              e.preventDefault()
              setActiveIndex((i) => Math.max(i - 1, 0))
            } else if (e.key === "Enter") {
              e.preventDefault()
              go(activeIndex)
            } else if (e.key === "Escape") {
              setOpen(false)
              inputRef.current?.blur()
            }
          }}
          placeholder="Search across organizations, assets, tickets..."
          className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden rounded border bg-background px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground sm:inline">
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute top-full left-0 z-50 mt-2 w-full overflow-hidden rounded-xl border bg-popover text-popover-foreground shadow-soft-lg">
          <div className="max-h-96 overflow-y-auto p-2">
            {searching ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">Searching...</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No matching records.</p>
            ) : (
              results.map((result, index) => {
                const Icon = GLOBAL_RESULT_ICON[result.type]
                return (
                  <button
                    key={`${result.type}-${result.id}`}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => go(index)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors duration-150",
                      index === activeIndex ? "bg-accent text-accent-foreground" : "text-foreground"
                    )}
                  >
                    <Icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{result.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {GLOBAL_RESULT_LABEL[result.type]}
                      {result.organizationName && result.type !== "organization" ? ` · ${result.organizationName}` : ""}
                    </span>
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}
