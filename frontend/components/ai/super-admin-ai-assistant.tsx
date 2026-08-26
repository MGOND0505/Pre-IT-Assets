"use client"

import * as React from "react"
import Link from "next/link"
import { useReducedMotion } from "motion/react"
import { Send } from "lucide-react"

import { apiClient, type ApiEnvelope } from "@/lib/api-client"
import { GLOBAL_RESULT_ICON, GLOBAL_RESULT_LABEL, globalResultHref, type GlobalSearchResult } from "@/lib/global-search-results"
import { cn } from "@/lib/utils"
import { OPEN_SUPER_ADMIN_AI_ASSISTANT_EVENT } from "@/lib/ai-assistant-events"
import { Sheet, SheetContent, SheetHeader } from "@/components/ui/sheet"

type Message = { id: string; role: "user" | "assistant"; text: string; results?: GlobalSearchResult[] }

// Same "describe, don't send verbatim" pattern as the org-scoped assistant's search tips.
const SEARCH_TIPS = [
  "Find an organization by name",
  "Look up a person by name or email",
  "Find an asset by name or serial number",
  "Look up a ticket by subject or ID",
]

const NOT_CONNECTED_REPLY =
  "I couldn't find anything matching that across any organization, and I'm not connected to a conversational AI backend yet, so I can't answer open-ended questions. Try searching for an organization, asset, ticket, or person by name or ID instead."

let idCounter = 0
function nextId() {
  idCounter += 1
  return `sa-msg-${idCounter}`
}

/** The Super Admin panel's counterpart to the org-scoped AI Assistant - same honest,
 * real-search-only pattern, just pointed at the cross-organization search endpoint since there
 * is no single org context here. */
export function SuperAdminAiAssistant() {
  const [open, setOpen] = React.useState(false)
  const [input, setInput] = React.useState("")
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: nextId(),
      role: "assistant",
      text: "Hi, I'm your AI Assistant. I can search across every organization's organizations, users, assets, and tickets, and link you straight to them. I'm not connected to a conversational AI backend yet, so open-ended questions still get an honest \"not yet\" - try searching for something below.",
    },
  ])
  const prefersReducedMotion = useReducedMotion()
  const listRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: prefersReducedMotion ? "auto" : "smooth" })
  }, [messages, prefersReducedMotion])

  // Opened from the sidebar's "Open Assistant" card, not a floating trigger this component
  // renders itself - see ai-assistant-sidebar-card.tsx.
  React.useEffect(() => {
    const handler = () => setOpen(true)
    window.addEventListener(OPEN_SUPER_ADMIN_AI_ASSISTANT_EVENT, handler)
    return () => window.removeEventListener(OPEN_SUPER_ADMIN_AI_ASSISTANT_EVENT, handler)
  }, [])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    setInput("")
    setMessages((prev) => [...prev, { id: nextId(), role: "user", text: trimmed }])

    let results: GlobalSearchResult[] = []
    if (trimmed.length >= 2) {
      try {
        const res = await apiClient.get<ApiEnvelope<GlobalSearchResult[]>>("/organizations/global-search", { params: { q: trimmed } })
        results = res.data.data
      } catch {
        results = []
      }
    }

    if (results.length > 0) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          text: `Found ${results.length} match${results.length === 1 ? "" : "es"} for "${trimmed}":`,
          results,
        },
      ])
    } else {
      setMessages((prev) => [...prev, { id: nextId(), role: "assistant", text: NOT_CONNECTED_REPLY }])
    }
  }

  return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="flex w-full flex-col gap-0 p-0 sm:max-w-sm">
          <SheetHeader className="flex-row items-center gap-2 border-b py-3">
            <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/ai-logo.png" alt="" className="size-full object-cover" />
            </span>
            <div className="flex-1">
              <p className="font-heading text-sm font-semibold">AI Assistant</p>
              <p className="text-xs text-muted-foreground">Across all organizations</p>
            </div>
          </SheetHeader>

          <div ref={listRef} className="flex-1 overflow-y-auto p-4">
            <div className="flex flex-col gap-3">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed",
                    message.role === "assistant"
                      ? "self-start bg-muted text-foreground"
                      : "self-end bg-primary text-primary-foreground"
                  )}
                >
                  <p>{message.text}</p>
                  {message.results && message.results.length > 0 && (
                    <div className="mt-2 flex flex-col gap-1">
                      {message.results.map((result) => {
                        const Icon = GLOBAL_RESULT_ICON[result.type]
                        return (
                          <Link
                            key={`${result.type}-${result.id}`}
                            href={globalResultHref(result)}
                            onClick={() => setOpen(false)}
                            className="flex items-center gap-2 rounded-md bg-background/60 px-2 py-1.5 text-foreground transition-colors hover:bg-background"
                          >
                            <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                            <span className="flex-1 truncate text-xs font-medium">{result.title}</span>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {GLOBAL_RESULT_LABEL[result.type]}
                            </span>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {messages.length <= 1 && (
              <div className="mt-4 flex flex-col gap-1.5">
                <p className="px-1 text-xs font-medium text-muted-foreground">Try searching for</p>
                {SEARCH_TIPS.map((tip) => (
                  <button
                    key={tip}
                    type="button"
                    onClick={() => inputRef.current?.focus()}
                    className="rounded-lg border px-3 py-2 text-left text-sm text-foreground/80 transition-colors duration-150 hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
                  >
                    {tip}
                  </button>
                ))}
              </div>
            )}
          </div>

          <form
            className="flex items-center gap-2 border-t p-3"
            onSubmit={(e) => {
              e.preventDefault()
              send(input)
            }}
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Search organizations, assets, tickets, people..."
              className="h-9 flex-1 rounded-lg border bg-background px-3 text-sm outline-none transition-colors focus:border-ring focus:ring-3 focus:ring-ring/30"
            />
            <button
              type="submit"
              aria-label="Send"
              disabled={!input.trim()}
              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white transition-transform duration-150 hover:-translate-y-px disabled:opacity-40"
              style={{ backgroundImage: "linear-gradient(135deg, var(--ai-from), var(--ai-to))" }}
            >
              <Send className="size-4" />
            </button>
          </form>
        </SheetContent>
      </Sheet>
  )
}
