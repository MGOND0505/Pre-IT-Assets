"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Send, Sparkles, CheckCircle2, XCircle, Loader2, Plus, Trash2, Users } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { apiClient, apiErrorMessage, orgScopedApiUrl, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FullPageLoader } from "@/components/layout/full-page-loader"
import { DataTable } from "@/components/common/data-table"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { cn } from "@/lib/utils"

type PendingChange = {
  token: string
  assetLabel: string
  summary: string
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown>
}

type AssetSummary = {
  assetId: string
  name: string
  status: string
  category: string | null
  manufacturer: string
  model: string
  assignedUser: string | null
  department: string | null
  location: string | null
}

type ChatResults = { total: number; page: number; totalPages: number; assets: AssetSummary[] }

type ChangeResolution = "confirmed" | "cancelled"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  pendingChange?: PendingChange | null
  results?: ChatResults | null
  resolution?: ChangeResolution | null
}

type SessionSummary = {
  _id: string
  title: string
  lastMessageAt: string
  user?: { name: string; email: string }
}

type ChatMessageDoc = {
  _id: string
  role: "user" | "assistant"
  content: string
  pendingChange: PendingChange | null
  results: ChatResults | null
  resolution: ChangeResolution | null
}

let idCounter = 0
function nextId(): string {
  idCounter += 1
  return `aiq-${idCounter}`
}

const WELCOME_MESSAGE =
  "Hi, I'm AssetIQ AI. Ask me anything about your organization's assets, helpdesk tickets, or tasks - who has what, warranty status, ticket status, who a task is assigned to. I can also assign, transfer, return, mark damaged/lost, or retire an asset - I'll always show you the exact change first and wait for your confirmation before anything is actually applied."

const SUGGESTIONS = [
  "Which assets are under warranty?",
  "Show all laptops that are currently available",
  "Show me open tickets assigned to me",
  "What tasks are due this week?",
]

const ASSET_COLUMNS: ColumnDef<AssetSummary, unknown>[] = [
  { accessorKey: "assetId", header: "Asset ID" },
  { accessorKey: "name", header: "Name" },
  { accessorKey: "status", header: "Status" },
  { accessorKey: "category", header: "Category", meta: { hideBelow: "md" } },
  { accessorKey: "assignedUser", header: "Assigned to", meta: { hideBelow: "md" } },
  { accessorKey: "department", header: "Department", meta: { hideBelow: "lg" } },
  { accessorKey: "location", header: "Location", meta: { hideBelow: "lg" } },
]

function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-"
  if (value instanceof Date) return value.toLocaleDateString()
  if (typeof value === "object") return JSON.stringify(value)
  return String(value)
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
}

function welcomeMessage(): Message {
  return { id: nextId(), role: "assistant", content: WELCOME_MESSAGE }
}

/** The before/after diff card shown for a proposed write - nothing is applied to the database
 * until the user clicks Confirm here, which calls a real, separate endpoint. Once acted on, the
 * card locks into its resolved state so it can't be confirmed/cancelled twice. */
function ChangeCard({
  change,
  resolution,
  busy,
  readOnly,
  onConfirm,
  onCancel,
}: {
  change: PendingChange
  resolution?: ChangeResolution | null
  busy: boolean
  readOnly: boolean
  onConfirm: () => void
  onCancel: () => void
}) {
  const fields = Array.from(new Set([...Object.keys(change.oldValue ?? {}), ...Object.keys(change.newValue)])).filter(
    (key) => key in change.newValue
  )

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="size-4 shrink-0 text-primary" />
        <p className="text-sm font-semibold">Proposed change</p>
        <Badge variant="outline" className="text-[10px]">
          {change.assetLabel}
        </Badge>
      </div>
      <p className="text-sm text-muted-foreground">{change.summary}</p>
      <div className="overflow-x-auto rounded-lg border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-2 text-left font-medium">Field</th>
              <th className="p-2 text-left font-medium">Current</th>
              <th className="p-2 text-left font-medium">New</th>
            </tr>
          </thead>
          <tbody>
            {fields.map((field) => (
              <tr key={field} className="border-b last:border-b-0">
                <td className="p-2 font-medium">{field}</td>
                <td className="p-2 text-muted-foreground">{formatValue(change.oldValue?.[field])}</td>
                <td className="p-2 text-foreground">{formatValue(change.newValue[field])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {resolution === "confirmed" ? (
        <p className="flex items-center gap-1.5 text-sm font-medium text-success">
          <CheckCircle2 className="size-4" />
          Applied
        </p>
      ) : resolution === "cancelled" ? (
        <p className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
          <XCircle className="size-4" />
          Cancelled
        </p>
      ) : readOnly ? (
        <p className="text-sm text-muted-foreground">Awaiting the requester's confirmation.</p>
      ) : (
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" onClick={onConfirm} disabled={busy}>
            {busy ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
            Confirm
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}

export default function AiAssistantPage() {
  const { user, loading: authLoading } = useAuth()
  const toOrgHref = useOrgHref()
  const [messages, setMessages] = React.useState<Message[]>([welcomeMessage()])
  const [input, setInput] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [toolStatus, setToolStatus] = React.useState<string | null>(null)
  const [actingToken, setActingToken] = React.useState<string | null>(null)
  const [sessions, setSessions] = React.useState<SessionSummary[]>([])
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(null)
  const [scope, setScope] = React.useState<"mine" | "all">("mine")
  const [loadingSession, setLoadingSession] = React.useState(false)
  const [pendingDelete, setPendingDelete] = React.useState<SessionSummary | null>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const isReadOnlyConversation = scope === "all" && activeSessionId !== null

  const loadSessions = React.useCallback(async () => {
    try {
      const res = await apiClient.get<ApiEnvelope<SessionSummary[]>>("/ai-assistant/sessions", { params: { scope } })
      setSessions(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load conversations"))
    }
  }, [scope])

  React.useEffect(() => {
    loadSessions()
  }, [loadSessions])

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  function startNewChat() {
    setActiveSessionId(null)
    setMessages([welcomeMessage()])
    setInput("")
    inputRef.current?.focus()
  }

  async function openSession(session: SessionSummary) {
    setLoadingSession(true)
    try {
      const res = await apiClient.get<ApiEnvelope<ChatMessageDoc[]>>(`/ai-assistant/sessions/${session._id}/messages`)
      setActiveSessionId(session._id)
      setMessages(
        res.data.data.map((m) => ({
          id: m._id,
          role: m.role,
          content: m.content,
          pendingChange: m.pendingChange,
          results: m.results,
          resolution: m.resolution,
        }))
      )
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load this conversation"))
    } finally {
      setLoadingSession(false)
    }
  }

  async function handleDeleteSession(session: SessionSummary) {
    try {
      await apiClient.delete(`/ai-assistant/sessions/${session._id}`)
      if (activeSessionId === session._id) startNewChat()
      loadSessions()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete this conversation"))
    } finally {
      setPendingDelete(null)
    }
  }

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending || isReadOnlyConversation) return
    const isNewConversation = !activeSessionId
    setInput("")
    setMessages((prev) => [...prev, { id: nextId(), role: "user", content: trimmed }])
    const assistantId = nextId()
    setMessages((prev) => [...prev, { id: assistantId, role: "assistant", content: "" }])
    setSending(true)
    setToolStatus(null)
    let accumulated = ""

    function patchAssistant(patch: Partial<Message>) {
      setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, ...patch } : m)))
    }

    try {
      const res = await fetch(orgScopedApiUrl("/ai-assistant/chat"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ message: trimmed, sessionId: activeSessionId ?? undefined }),
      })

      const contentType = res.headers.get("content-type") ?? ""
      if (!contentType.includes("text/event-stream") || !res.body) {
        const envelope = (await res.json().catch(() => null)) as ApiEnvelope<null> | null
        throw new Error(envelope?.message ?? "AssetIQ AI is not available right now.")
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { value, done } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        let boundary: number
        while ((boundary = buffer.indexOf("\n\n")) !== -1) {
          const rawEvent = buffer.slice(0, boundary)
          buffer = buffer.slice(boundary + 2)
          const dataLine = rawEvent.split("\n").find((l) => l.startsWith("data: "))
          if (!dataLine) continue
          const payload = JSON.parse(dataLine.slice(6))

          if (payload.type === "token") {
            setToolStatus(null)
            accumulated += payload.delta
            patchAssistant({ content: accumulated })
          } else if (payload.type === "tool_call") {
            setToolStatus(`Looking up ${String(payload.name).replace(/_/g, " ")}...`)
          } else if (payload.type === "done") {
            setToolStatus(null)
            patchAssistant({ pendingChange: payload.pendingChange, results: payload.results })
            if (isNewConversation) {
              setActiveSessionId(payload.sessionId)
              loadSessions()
            }
          } else if (payload.type === "error") {
            setToolStatus(null)
            patchAssistant({ content: payload.message })
          }
        }
      }
    } catch (err) {
      setToolStatus(null)
      patchAssistant({ content: err instanceof Error ? err.message : "AssetIQ AI is not available right now." })
    } finally {
      setSending(false)
    }
  }

  async function resolveChange(messageId: string, token: string, resolution: ChangeResolution) {
    setActingToken(token)
    try {
      await apiClient.post(resolution === "confirmed" ? "/ai-assistant/confirm" : "/ai-assistant/cancel", { token })
      if (resolution === "confirmed") toast.success("Change applied")
      setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, resolution } : m)))
    } catch (err) {
      if (resolution === "confirmed") {
        toast.error(apiErrorMessage(err, "Could not apply the change"))
      } else {
        // Cancel is best-effort - if the token already expired there's nothing left to discard,
        // so still lock the card rather than leaving a dead Confirm/Cancel pair on screen.
        setMessages((prev) => prev.map((m) => (m.id === messageId ? { ...m, resolution } : m)))
      }
    } finally {
      setActingToken(null)
    }
  }

  if (authLoading) return <FullPageLoader />

  if (!can(user, "aiAssistant", "view")) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl sm:text-2xl lg:text-[1.65rem] font-semibold tracking-tight">
          <Sparkles className="size-5 text-primary" />
          AssetIQ AI
        </h1>
        <p className="text-sm text-muted-foreground">Ask about your assets, tickets, and tasks in plain language, or request a change for review.</p>
      </div>

      <div className="flex h-[70vh] min-h-[420px] gap-4">
        <div className="hidden w-64 shrink-0 flex-col gap-3 rounded-xl border bg-card p-3 shadow-soft-sm sm:flex">
          <Button type="button" size="sm" className="w-full" onClick={startNewChat}>
            <Plus className="size-3.5" />
            New chat
          </Button>

          {user?.isAdmin && (
            <div className="flex rounded-lg border p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setScope("mine")}
                className={cn(
                  "flex-1 rounded-md px-2 py-1 transition-colors duration-150",
                  scope === "mine" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                My conversations
              </button>
              <button
                type="button"
                onClick={() => setScope("all")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 transition-colors duration-150",
                  scope === "all" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Users className="size-3" />
                Team activity
              </button>
            </div>
          )}

          <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto">
            {sessions.length === 0 && <p className="px-1 py-2 text-xs text-muted-foreground">No conversations yet.</p>}
            {sessions.map((session) => (
              <div
                key={session._id}
                className={cn(
                  "group flex items-start gap-1 rounded-lg px-2 py-1.5 text-left transition-colors duration-150 hover:bg-accent",
                  activeSessionId === session._id && "bg-accent"
                )}
              >
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openSession(session)}>
                  <p className="truncate text-xs font-medium text-foreground">{session.title}</p>
                  <p className="truncate text-[11px] text-muted-foreground">
                    {scope === "all" && session.user ? `${session.user.name} · ` : ""}
                    {formatTimestamp(session.lastMessageAt)}
                  </p>
                </button>
                {scope === "mine" && (
                  <button
                    type="button"
                    aria-label="Delete conversation"
                    className="shrink-0 rounded p-1 text-muted-foreground opacity-0 transition-opacity duration-150 hover:text-destructive group-hover:opacity-100"
                    onClick={() => setPendingDelete(session)}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border bg-card shadow-soft-sm">
          {isReadOnlyConversation && (
            <div className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">
              Viewing {sessions.find((s) => s._id === activeSessionId)?.user?.name ?? "another user"}'s conversation (read-only)
            </div>
          )}
          <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            {loadingSession && (
              <div className="flex items-center gap-2 self-center text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Loading conversation...
              </div>
            )}
            {!loadingSession &&
              messages.map((message, index) => {
                const isStreamingBubble = sending && index === messages.length - 1 && message.role === "assistant"
                return (
                <div key={message.id} className="flex flex-col gap-2">
                  <div
                    className={
                      message.role === "assistant"
                        ? "max-w-[85%] self-start rounded-lg bg-muted px-3 py-2 text-sm leading-relaxed text-foreground"
                        : "max-w-[85%] self-end rounded-lg bg-primary px-3 py-2 text-sm leading-relaxed text-primary-foreground"
                    }
                  >
                    {isStreamingBubble && !message.content ? (
                      <span className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="size-3.5 animate-spin" />
                        {toolStatus ?? "Thinking..."}
                      </span>
                    ) : (
                      <p className="whitespace-pre-wrap">
                        {message.content}
                        {isStreamingBubble && (
                          <span className="ml-0.5 inline-block h-3.5 w-1 animate-pulse bg-current align-text-bottom" />
                        )}
                      </p>
                    )}
                  </div>

                  {message.results && message.results.assets.length > 0 && (
                    <div className="flex flex-col gap-2 self-start w-full max-w-full">
                      <div className="rounded-xl border">
                        <DataTable columns={ASSET_COLUMNS} data={message.results.assets} />
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>
                          {message.results.total} matching asset{message.results.total === 1 ? "" : "s"}
                          {message.results.totalPages > 1 ? ` · page ${message.results.page} of ${message.results.totalPages}` : ""}
                        </span>
                        <Link href={toOrgHref("/assets")} className="hover:underline">
                          Open full Assets list &rarr;
                        </Link>
                      </div>
                    </div>
                  )}

                  {message.pendingChange && (
                    <div className="w-full max-w-lg self-start">
                      <ChangeCard
                        change={message.pendingChange}
                        resolution={message.resolution}
                        busy={actingToken === message.pendingChange.token}
                        readOnly={isReadOnlyConversation}
                        onConfirm={() => resolveChange(message.id, message.pendingChange!.token, "confirmed")}
                        onCancel={() => resolveChange(message.id, message.pendingChange!.token, "cancelled")}
                      />
                    </div>
                  )}
                </div>
                )
              })}

            {!loadingSession && messages.length === 1 && !activeSessionId && (
              <div className="flex flex-col gap-1.5">
                <p className="px-1 text-xs font-medium text-muted-foreground">Try asking</p>
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => inputRef.current?.focus()}
                    className="self-start rounded-lg border px-3 py-2 text-left text-sm text-foreground/80 transition-colors duration-150 hover:border-primary/40 hover:bg-accent hover:text-accent-foreground"
                  >
                    {suggestion}
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
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isReadOnlyConversation ? "Read-only - start a new chat to ask something" : "Ask about assets, tickets, tasks, or request a change..."}
              disabled={sending || isReadOnlyConversation}
              className="h-9"
            />
            <Button type="submit" size="icon" disabled={sending || !input.trim() || isReadOnlyConversation} aria-label="Send">
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      </div>

      {pendingDelete && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingDelete(null)}
          title={`Delete "${pendingDelete.title}"?`}
          description="This conversation and its messages will be permanently deleted."
          confirmLabel="Delete"
          destructive
          onConfirm={() => handleDeleteSession(pendingDelete)}
        />
      )}
    </div>
  )
}
