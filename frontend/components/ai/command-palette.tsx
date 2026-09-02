"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Search, CornerDownLeft, ArrowUp, ArrowDown, Sparkles, Loader2 } from "lucide-react"

import { Dialog, DialogPortal, DialogOverlay } from "@/components/ui/dialog"
import { isNavGroup, navConfig, type NavLeaf } from "@/lib/nav-config"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"
import { apiClient, type ApiEnvelope } from "@/lib/api-client"
import { SEARCH_RESULT_HREF, SEARCH_RESULT_ICON, SEARCH_RESULT_LABEL, type SearchResult } from "@/lib/search-results"
import { cn } from "@/lib/utils"

type AiChatResponse = { conversationId: string; reply: string }

/** A query that reads like a natural-language question/request rather than a short keyword -
 * the AI answer is only worth the extra round-trip (and, once a model is loaded, the extra
 * latency) for something the literal multi-token search below can't really answer anyway, e.g.
 * "which laptops are overdue for return" vs. just "dell laptop". */
function looksLikeNaturalLanguage(query: string): boolean {
  return query.trim().split(/\s+/).length >= 3
}

type FlatEntry = { label: string; group?: string; href: string; absolute?: boolean }

/** A real, functional quick-navigation search across every page the current user can actually
 * see, plus a live search across their organization's own data (assets, licenses, tickets,
 * tasks, vendors, departments, locations, users) - not an AI feature, just a fast Cmd/Ctrl+K
 * launcher in the command-palette style, with every result a genuine link to real data. */
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
      if (item.employeeHidden && user?.employeeTier === "employee") return false
      if (item.employeeOnly && user?.employeeTier !== "employee") return false
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

  // Real cross-entity search - assets, licenses, tickets, tasks, vendors, departments,
  // locations, users - scoped to the current org and filtered server-side to whatever this
  // user actually has permission to see. Debounced so it doesn't fire on every keystroke, and
  // skipped below the backend's own 2-character minimum.
  const [results, setResults] = React.useState<SearchResult[]>([])
  const [searching, setSearching] = React.useState(false)

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
        const res = await apiClient.get<ApiEnvelope<SearchResult[]>>("/search", { params: { q } })
        setResults(res.data.data)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [query])

  // A natural-language answer layer alongside the literal keyword search above - reuses the
  // existing RBAC-scoped AI Assistant chat endpoint as-is (same permission gate, same tool-calling
  // safety) rather than building a second, parallel search pipeline. Hidden entirely for a user
  // without aiAssistant.view, and silently absent (not an error toast) if Ollama isn't reachable -
  // this is a bonus layer on top of a search bar that already works fully without it.
  const canUseAi = can(user, "aiAssistant", "view")
  const [aiReply, setAiReply] = React.useState<string | null>(null)
  const [aiLoading, setAiLoading] = React.useState(false)
  const [aiFailed, setAiFailed] = React.useState(false)
  const aiConversationId = React.useRef<string | undefined>(undefined)

  React.useEffect(() => {
    const q = query.trim()
    if (!canUseAi || !looksLikeNaturalLanguage(q)) {
      setAiReply(null)
      setAiFailed(false)
      setAiLoading(false)
      return
    }
    setAiLoading(true)
    setAiFailed(false)
    const timer = setTimeout(async () => {
      try {
        const res = await apiClient.post<ApiEnvelope<AiChatResponse>>("/ai-assistant/chat", {
          message: q,
          conversationId: aiConversationId.current,
        })
        aiConversationId.current = res.data.data.conversationId
        setAiReply(res.data.data.reply)
      } catch {
        setAiReply(null)
        setAiFailed(true)
      } finally {
        setAiLoading(false)
      }
    }, 400)
    return () => clearTimeout(timer)
  }, [query, canUseAi])

  // Pages and data results share one flat, keyboard-navigable list (pages first, then results)
  // so ArrowUp/ArrowDown/Enter behave the same regardless of which section the match is in.
  const combined = React.useMemo(
    () => [
      ...filtered.map((entry) => ({ kind: "page" as const, entry })),
      ...results.map((result) => ({ kind: "result" as const, result })),
    ],
    [filtered, results]
  )

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

  function go(index: number) {
    const item = combined[index]
    if (!item) return
    if (item.kind === "page") {
      const href = item.entry.absolute ? item.entry.href : toOrgHref(item.entry.href)
      router.push(href)
    } else {
      router.push(toOrgHref(SEARCH_RESULT_HREF[item.result.type](item.result.id)))
    }
    setOpen(false)
    setQuery("")
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          setQuery("")
          setAiReply(null)
          setAiFailed(false)
          aiConversationId.current = undefined
        }
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
              placeholder="Search pages, assets, tickets, and more..."
              className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault()
                  setActiveIndex((i) => Math.min(i + 1, combined.length - 1))
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

          {canUseAi && looksLikeNaturalLanguage(query) && (
            <div className="border-b bg-muted/30 px-4 py-3">
              <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary">
                <Sparkles className="size-3.5" /> AI Assistant
              </div>
              {aiLoading ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" /> Thinking...
                </div>
              ) : aiReply ? (
                <p className="text-sm whitespace-pre-wrap">{aiReply}</p>
              ) : aiFailed ? (
                <p className="text-xs text-muted-foreground">AI Assistant is unavailable right now.</p>
              ) : null}
            </div>
          )}

          <div className="max-h-96 overflow-y-auto p-2">
            {combined.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {searching ? "Searching..." : "No matching pages or records."}
              </p>
            ) : (
              <>
                {filtered.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    {query.trim() && (
                      <p className="px-3 py-1 text-xs font-medium text-muted-foreground">Pages</p>
                    )}
                    {filtered.map((entry, index) => (
                      <button
                        key={`page-${entry.group ?? ""}-${entry.href}`}
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
                    ))}
                  </div>
                )}

                {results.length > 0 && (
                  <div className="mt-1 flex flex-col gap-0.5">
                    <p className="px-3 py-1 text-xs font-medium text-muted-foreground">Results</p>
                    {results.map((result, resultIndex) => {
                      const index = filtered.length + resultIndex
                      const Icon = SEARCH_RESULT_ICON[result.type]
                      return (
                        <button
                          key={`result-${result.type}-${result.id}`}
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
                            {SEARCH_RESULT_LABEL[result.type]}
                            {result.subtitle ? ` · ${result.subtitle}` : ""}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
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
