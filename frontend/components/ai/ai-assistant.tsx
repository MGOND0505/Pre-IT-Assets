"use client"

import * as React from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Sparkles, Send, Minus, X } from "lucide-react"

import { cn } from "@/lib/utils"

type Message = { id: string; role: "user" | "assistant"; text: string }

const SUGGESTED_PROMPTS = [
  "Summarize today's activity",
  "Show critical issues",
  "What needs my attention?",
  "Analyze recent activity",
]

// Deliberately honest, not a simulated AI response - no backend AI service exists yet for this
// app, and the assistant must never pretend otherwise (see the design brief's "do not create
// fake AI responses" rule). Every reply says exactly this until a real integration lands.
const NOT_CONNECTED_REPLY =
  "AI features aren't connected to a live backend yet, so I can't act on that right now. This panel is a preview of the experience - once an AI service is wired up, I'll be able to help for real."

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
      text: "Hi, I'm your AI Assistant. I'm not connected to a live AI backend yet, so think of this as a preview of the experience - try a prompt below.",
    },
  ])
  const prefersReducedMotion = useReducedMotion()
  const listRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: prefersReducedMotion ? "auto" : "smooth" })
  }, [messages, prefersReducedMotion])

  function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed) return
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", text: trimmed },
      { id: nextId(), role: "assistant", text: NOT_CONNECTED_REPLY },
    ])
    setInput("")
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
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full text-white"
                style={{ backgroundImage: "linear-gradient(135deg, var(--ai-from), var(--ai-to))" }}
              >
                <Sparkles className="size-4" />
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
                    {message.text}
                  </div>
                ))}
              </div>

              {messages.length <= 1 && (
                <div className="mt-4 flex flex-col gap-1.5">
                  <p className="px-1 text-xs font-medium text-muted-foreground">Try asking</p>
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => send(prompt)}
                      className="rounded-lg border px-3 py-2 text-left text-sm text-foreground/80 transition-colors duration-150 hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
                    >
                      {prompt}
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
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask anything..."
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
        className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full text-white shadow-soft-lg transition-transform duration-200 hover:scale-105 active:scale-95"
        style={{ backgroundImage: "linear-gradient(135deg, var(--ai-from), var(--ai-to))" }}
      >
        {!open && !prefersReducedMotion && (
          <span className="absolute inset-0 rounded-full" style={{ backgroundColor: "var(--ai-from)", animation: "ai-pulse 2.4s ease-in-out infinite" }} aria-hidden />
        )}
        <Sparkles className="relative size-6" />
      </button>
    </>
  )
}
