import * as React from "react"
import { Plus, Pencil, Trash2, Upload, LogIn, LogOut, History } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"

export type ActivityEntry = {
  _id: string
  action: string
  module: string
  recordLabel: string | null
  userSnapshot: { name: string | null }
  createdAt: string
  // Only present on the cross-organization Super Admin feed - the org-scoped dashboard's own
  // feed never sends this (its org is already implicit), so it stays undefined there.
  organizationName?: string | null
}

const ACTION_VERB: Record<string, string> = {
  CREATE: "created",
  UPDATE: "updated",
  DELETE: "deleted",
  IMPORT: "imported",
  LOGIN: "logged in",
  LOGOUT: "logged out",
}

const ACTION_STYLE: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  CREATE: { icon: Plus, color: "var(--success)" },
  UPDATE: { icon: Pencil, color: "var(--info)" },
  DELETE: { icon: Trash2, color: "var(--destructive)" },
  IMPORT: { icon: Upload, color: "var(--info)" },
  LOGIN: { icon: LogIn, color: "var(--muted-foreground)" },
  LOGOUT: { icon: LogOut, color: "var(--muted-foreground)" },
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

export function ActivityFeedSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="size-8 shrink-0 rounded-full" />
          <Skeleton className="h-4 flex-1" />
        </div>
      ))}
    </div>
  )
}

export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col">
      {entries.map((entry, index) => {
        const style = ACTION_STYLE[entry.action] ?? { icon: History, color: "var(--muted-foreground)" }
        const Icon = style.icon
        const isLast = index === entries.length - 1

        return (
          <li key={entry._id} className="group flex gap-3 rounded-lg px-2 py-2 -mx-2 transition-colors hover:bg-muted/50">
            <div className="flex flex-col items-center">
              <span
                className="flex size-8 shrink-0 items-center justify-center rounded-full ring-4 ring-card"
                style={{
                  backgroundColor: `color-mix(in oklch, ${style.color} 15%, transparent)`,
                  color: style.color,
                }}
              >
                <Icon className="size-4" />
              </span>
              {!isLast && <div className="mt-1 w-px flex-1 bg-border" />}
            </div>
            <div className="flex flex-1 items-start justify-between gap-3 pb-4 text-sm">
              <span>
                <span className="font-medium">{entry.userSnapshot.name ?? "System"}</span>{" "}
                <span className="text-muted-foreground">{ACTION_VERB[entry.action] ?? entry.action.toLowerCase()}</span>{" "}
                {entry.recordLabel ?? entry.module}
                {entry.organizationName && (
                  <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {entry.organizationName}
                  </span>
                )}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(entry.createdAt)}</span>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
