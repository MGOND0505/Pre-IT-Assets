"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Send, Sparkles, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import type { ColumnDef } from "@tanstack/react-table"

import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FullPageLoader } from "@/components/layout/full-page-loader"
import { DataTable } from "@/components/common/data-table"

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
  resolution?: ChangeResolution
}

let idCounter = 0
function nextId(): string {
  idCounter += 1
  return `aiq-${idCounter}`
}

const WELCOME_MESSAGE =
  "Hi, I'm AssetIQ AI. Ask me anything about your organization's assets - who has what, warranty status, availability, full details or history of a specific asset. I can also assign, transfer, return, mark damaged/lost, or retire an asset - I'll always show you the exact change first and wait for your confirmation before anything is actually applied."

const SUGGESTIONS = [
  "Which assets are under warranty?",
  "Show all laptops that are currently available",
  "Which assets need replacement?",
  "Show complete details of asset ...",
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

/** The before/after diff card shown for a proposed write - nothing is applied to the database
 * until the user clicks Confirm here, which calls a real, separate endpoint. Once acted on, the
 * card locks into its resolved state so it can't be confirmed/cancelled twice. */
function ChangeCard({
  change,
  resolution,
  busy,
  onConfirm,
  onCancel,
}: {
  change: PendingChange
  resolution?: ChangeResolution
  busy: boolean
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
  const [messages, setMessages] = React.useState<Message[]>([{ id: nextId(), role: "assistant", content: WELCOME_MESSAGE }])
  const [input, setInput] = React.useState("")
  const [sending, setSending] = React.useState(false)
  const [actingToken, setActingToken] = React.useState<string | null>(null)
  const listRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" })
  }, [messages])

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    setInput("")
    setMessages((prev) => [...prev, { id: nextId(), role: "user", content: trimmed }])
    setSending(true)
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      const res = await apiClient.post<
        ApiEnvelope<{ reply: string; pendingChange: PendingChange | null; results: ChatResults | null }>
      >("/ai-assistant/chat", { message: trimmed, history })
      const { reply, pendingChange, results } = res.data.data
      setMessages((prev) => [...prev, { id: nextId(), role: "assistant", content: reply, pendingChange, results }])
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: apiErrorMessage(err, "AssetIQ AI is not available right now.") },
      ])
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
        <p className="text-sm text-muted-foreground">Ask about your assets in plain language, or request a change for review.</p>
      </div>

      <div className="flex h-[70vh] min-h-[420px] flex-col overflow-hidden rounded-xl border bg-card shadow-soft-sm">
        <div ref={listRef} className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
          {messages.map((message) => (
            <div key={message.id} className="flex flex-col gap-2">
              <div
                className={
                  message.role === "assistant"
                    ? "max-w-[85%] self-start rounded-lg bg-muted px-3 py-2 text-sm leading-relaxed text-foreground"
                    : "max-w-[85%] self-end rounded-lg bg-primary px-3 py-2 text-sm leading-relaxed text-primary-foreground"
                }
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
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
                    onConfirm={() => resolveChange(message.id, message.pendingChange!.token, "confirmed")}
                    onCancel={() => resolveChange(message.id, message.pendingChange!.token, "cancelled")}
                  />
                </div>
              )}
            </div>
          ))}

          {messages.length === 1 && (
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

          {sending && (
            <div className="flex max-w-[85%] items-center gap-2 self-start rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" />
              Thinking...
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
            placeholder="Ask about assets, or request a change..."
            disabled={sending}
            className="h-9"
          />
          <Button type="submit" size="icon" disabled={sending || !input.trim()} aria-label="Send">
            <Send className="size-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
