"use client"

import * as React from "react"
import { HeartPulse } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { apiClient, type ApiEnvelope } from "@/lib/api-client"

type HealthResponse = { status: "ok" | "degraded"; db: "connected" | "disconnected"; timestamp: string }

/**
 * The dashboard's one real "System Health" signal - the existing /api/health endpoint's actual
 * database connection state (Mongoose's own connection.readyState under the hood), polled every
 * 30s. Deliberately does NOT show uptime, disk space, or backup status - none of those exist as
 * real, checkable signals in this app yet, and this card only ever reports what's actually true.
 */
export function SystemHealthCard() {
  const [health, setHealth] = React.useState<HealthResponse | null>(null)
  const [checking, setChecking] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function check() {
      try {
        const res = await apiClient.get<ApiEnvelope<HealthResponse>>("/health")
        if (!cancelled) setHealth(res.data.data)
      } catch {
        if (!cancelled) setHealth({ status: "degraded", db: "disconnected", timestamp: new Date().toISOString() })
      } finally {
        if (!cancelled) setChecking(false)
      }
    }
    check()
    const interval = setInterval(check, 30000)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [])

  const isOk = health?.status === "ok"
  const color = checking ? "var(--muted-foreground)" : isOk ? "var(--success)" : "var(--destructive)"

  return (
    <Card
      className="group/card relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg"
      style={{ borderTopWidth: 3, borderTopColor: color }}
    >
      <CardContent className="flex items-start justify-between gap-3 pt-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">System Health</span>
          <span className="text-xl leading-none font-semibold tracking-tight sm:text-2xl lg:text-[1.7rem]" style={{ color: checking ? undefined : color }}>
            {checking ? "Checking..." : isOk ? "Operational" : "Degraded"}
          </span>
          <span className="text-xs text-muted-foreground">
            {checking ? "Contacting database" : `Database: ${health?.db}`}
          </span>
        </div>
        <div
          className="flex size-10 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset transition-transform duration-300 group-hover/card:scale-105"
          style={{
            backgroundImage: `linear-gradient(135deg, color-mix(in oklch, ${color} 18%, transparent), color-mix(in oklch, ${color} 6%, transparent))`,
            color,
            ["--tw-ring-color" as string]: `color-mix(in oklch, ${color} 20%, transparent)`,
          }}
        >
          <HeartPulse className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}
