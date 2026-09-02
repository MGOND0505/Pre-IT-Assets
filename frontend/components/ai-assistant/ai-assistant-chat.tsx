"use client"

import * as React from "react"
import { toast } from "sonner"
import { Loader2, Send } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { AiAssistantIcon } from "@/components/ai-assistant/ai-assistant-logo"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { can } from "@/lib/permissions"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

type PendingTicket = {
  subject: string
  description: string
  categoryName: string | null
  priority: string | null
}

type ChatRole = "user" | "assistant" | "tool"

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
  pendingTicket?: PendingTicket
  ticketStatus?: "pending" | "confirmed" | "discarded"
}

type ChatResponse = {
  conversationId: string
  reply: string
  pendingTicket?: PendingTicket
}

type ConfirmedTicket = {
  _id: string
  ticketId: string
}

/**
 * The AI Assistant's chat body - message list, composer, and inline ticket-draft confirmation.
 * Shared between the full `/ai-assistant` page and the floating widget (see
 * `ai-assistant-widget.tsx`) so both stay behaviorally identical rather than drifting apart -
 * only the surrounding chrome (page header vs. popover header, panel height) differs per caller.
 */
export function AiAssistantChat({ panelHeightClassName = "h-[65vh]" }: { panelHeightClassName?: string }) {
  const { user } = useAuth()
  const canCreateTicket = can(user, "helpdesk", "create")

  const [messages, setMessages] = React.useState<ChatMessage[]>([])
  const [input, setInput] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [conversationId, setConversationId] = React.useState<string | undefined>(undefined)
  const [confirmingId, setConfirmingId] = React.useState<string | null>(null)

  // Simple monotonically increasing counter for stable, unique message keys - avoids depending
  // on crypto.randomUUID() availability, and is unaffected by React 18 dev-mode double-invoking.
  const idCounter = React.useRef(0)
  const nextId = React.useCallback(() => {
    idCounter.current += 1
    return `msg-${idCounter.current}`
  }, [])

  const bottomRef = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, sending])

  const handleSend = React.useCallback(async () => {
    const trimmed = input.trim()
    if (!trimmed || sending) return

    const userMessage: ChatMessage = { id: nextId(), role: "user", content: trimmed }
    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setSending(true)
    try {
      const res = await apiClient.post<ApiEnvelope<ChatResponse>>("/ai-assistant/chat", {
        message: trimmed,
        conversationId,
      })
      const data = res.data.data
      setConversationId(data.conversationId)
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: data.reply,
          pendingTicket: data.pendingTicket,
          ticketStatus: data.pendingTicket ? "pending" : undefined,
        },
      ])
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not reach the AI Assistant"))
    } finally {
      setSending(false)
    }
  }, [input, sending, conversationId, nextId])

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  async function handleConfirmTicket(message: ChatMessage) {
    const ticket = message.pendingTicket
    if (!ticket) return
    setConfirmingId(message.id)
    try {
      const res = await apiClient.post<ApiEnvelope<ConfirmedTicket>>("/ai-assistant/confirm-ticket", { ...ticket })
      toast.success(`Ticket ${res.data.data.ticketId} created`)
      setMessages((prev) => prev.map((m) => (m.id === message.id ? { ...m, ticketStatus: "confirmed" } : m)))
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not create ticket"))
    } finally {
      setConfirmingId(null)
    }
  }

  function handleDiscardTicket(id: string) {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, ticketStatus: "discarded" } : m)))
  }

  return (
    <Card>
      <CardContent className={cn("flex flex-col gap-3 pt-6", panelHeightClassName)}>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto pr-1">
          {messages.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Say hello, or ask something like &quot;What&apos;s the status of my open tickets?&quot;
            </p>
          )}

          {messages.map((m) => {
            if (m.role === "tool") {
              return (
                <p key={m.id} className="text-xs text-muted-foreground italic">
                  {m.content}
                </p>
              )
            }

            const isUser = m.role === "user"
            return (
              <div key={m.id} className={cn("flex flex-col gap-2", isUser && "items-end")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap",
                    isUser ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}
                >
                  {m.content}
                </div>

                {m.pendingTicket && m.ticketStatus === "pending" && (
                  <Card className="w-full max-w-[80%] ring-1 ring-primary/30">
                    <CardContent className="flex flex-col gap-2 pt-4 text-sm">
                      <div className="flex items-center gap-1.5 text-xs font-medium text-primary">
                        <AiAssistantIcon className="size-4" /> Draft ticket
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Subject</div>
                        <div className="font-medium">{m.pendingTicket.subject}</div>
                      </div>
                      <div>
                        <div className="text-xs text-muted-foreground">Description</div>
                        <p className="whitespace-pre-wrap">{m.pendingTicket.description || "-"}</p>
                      </div>
                      <div className="flex flex-wrap gap-6">
                        <div>
                          <div className="text-xs text-muted-foreground">Category</div>
                          {m.pendingTicket.categoryName ?? "-"}
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground">Priority</div>
                          {m.pendingTicket.priority ?? "-"}
                        </div>
                      </div>
                      {!canCreateTicket && (
                        <p className="text-xs text-muted-foreground">
                          You do not have permission to create tickets, so this draft cannot be confirmed. Ask an
                          admin to create it on your behalf if needed.
                        </p>
                      )}
                      <div className="flex gap-2 pt-1">
                        <Button
                          size="sm"
                          disabled={!canCreateTicket || confirmingId === m.id}
                          onClick={() => handleConfirmTicket(m)}
                        >
                          {confirmingId === m.id ? "Creating..." : "Confirm & Create Ticket"}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleDiscardTicket(m.id)}>
                          Discard
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
                {m.pendingTicket && m.ticketStatus === "confirmed" && (
                  <p className="text-xs text-muted-foreground">Ticket created.</p>
                )}
                {m.pendingTicket && m.ticketStatus === "discarded" && (
                  <p className="text-xs text-muted-foreground">Draft discarded.</p>
                )}
              </div>
            )
          })}

          {sending && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" /> AI Assistant is typing...
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        <div className="flex items-end gap-2 border-t pt-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message... (Enter to send, Shift+Enter for a new line)"
            className="min-h-11 flex-1 resize-none"
            disabled={sending}
          />
          <Button onClick={handleSend} disabled={sending || !input.trim()} size="icon" aria-label="Send message">
            {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
