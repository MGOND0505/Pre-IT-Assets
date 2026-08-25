"use client"

import * as React from "react"
import Link from "next/link"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Send, Minus, X } from "lucide-react"

import { apiClient, type ApiEnvelope } from "@/lib/api-client"
import { useOrgHref } from "@/lib/use-org-href"
import { SEARCH_RESULT_HREF, SEARCH_RESULT_ICON, SEARCH_RESULT_LABEL, type SearchResult } from "@/lib/search-results"
import { cn } from "@/lib/utils"

type Message = { id: string; role: "user" | "assistant"; text: string; results?: SearchResult[] }

// These describe what a search can find, they're not sent verbatim - clicking one drops its
// text into the input for the user to finish (a real asset name, ticket ID, email, etc.),
// rather than firing a literal query that's guaranteed to come back empty.
const SEARCH_TIPS = [
  "Find an asset by name or serial number",
  "Look up a ticket by subject or ID",
  "Search for a person by name or email",
  "Find a license, vendor, or task",
]

// Deliberately honest, not a simulated AI response - there is no conversational AI backend for
// this app (summarizing, analyzing, answering open-ended questions), and the assistant must
// never pretend otherwise (see the design brief's "do not create fake AI responses" rule). Any
// message that isn't a real data match falls back to exactly this line.
const NOT_CONNECTED_REPLY =
  "I couldn't find anything matching that, and I'm not connected to a conversational AI backend yet, so I can't answer open-ended questions. Try searching for an asset, license, ticket, task, vendor, or person by name or ID instead."

let idCounter = 0
function nextId() {
  idCounter += 1
  return `msg-${idCounter}`
}

export function AiAssistant() {
  const [open, setOpen] = React.useState(false)
  const [input, setInput] = React.useState("")
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: nextId(),
      role: "assistant",
      text: "Hi, I'm your AI Assistant. I can search your organization's assets, licenses, tickets, tasks, vendors, departments, locations, and people, and link you straight to them. I'm not connected to a conversational AI backend yet, so open-ended questions still get an honest \"not yet\" - try searching for something below.",
    },
  ])
  const prefersReducedMotion = useReducedMotion()
  const listRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const toOrgHref = useOrgHref()

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: prefersReducedMotion ? "auto" : "smooth" })
  }, [messages, prefersReducedMotion])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    setInput("")
    setMessages((prev) => [...prev, { id: nextId(), role: "user", text: trimmed }])

    // Real search, not a simulated reply - matched against the same live data every other page
    // reads from, scoped to this org and filtered to what the current user can actually see.
    let results: SearchResult[] = []
    if (trimmed.length >= 2) {
      try {
        const res = await apiClient.get<ApiEnvelope<SearchResult[]>>("/search", { params: { q: trimmed } })
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
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={prefersReducedMotion ? undefined : { opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={prefersReducedMotion ? undefined : { opacity: 0, y: 16, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-24 right-6 z-50 flex h-[520px] w-[min(24rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-xl border bg-card text-card-foreground shadow-soft-lg ai-border-glow"
          >
            <div className="flex items-center gap-2 border-b px-4 py-3">
              <span className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/ai-logo.png" alt="" className="size-full object-cover" />
              </span>
              <div className="flex-1">
                <p className="font-heading text-sm font-semibold">AI Assistant</p>
                <p className="text-xs text-muted-foreground">Preview experience</p>
              </div>
              <button
                type="button"
                aria-label="Minimize"
                onClick={() => setOpen(false)}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <Minus className="size-4" />
              </button>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

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
                          const Icon = SEARCH_RESULT_ICON[result.type]
                          return (
                            <Link
                              key={`${result.type}-${result.id}`}
                              href={toOrgHref(SEARCH_RESULT_HREF[result.type](result.id))}
                              onClick={() => setOpen(false)}
                              className="flex items-center gap-2 rounded-md bg-background/60 px-2 py-1.5 text-foreground transition-colors hover:bg-background"
                            >
                              <Icon className="size-3.5 shrink-0 text-muted-foreground" />
                              <span className="flex-1 truncate text-xs font-medium">{result.title}</span>
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {SEARCH_RESULT_LABEL[result.type]}
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
                placeholder="Search assets, tickets, licenses, people..."
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
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        aria-label={open ? "Close AI Assistant" : "Open AI Assistant"}
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center overflow-hidden rounded-full shadow-soft-lg transition-transform duration-200 hover:scale-105 active:scale-95"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/ai-logo.png" alt="" className="absolute inset-0 size-full object-cover" />
        {!open && !prefersReducedMotion && (
          <span
            className="absolute inset-0 rounded-full mix-blend-overlay"
            style={{ backgroundColor: "var(--ai-from)", animation: "ai-pulse 2.4s ease-in-out infinite" }}
            aria-hidden
          />
        )}
      </button>
    </>
  )
}
