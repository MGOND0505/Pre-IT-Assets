"use client"

import * as React from "react"
import { Area, AreaChart, ResponsiveContainer } from "recharts"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { useCountUp } from "./use-count-up"

export type Bucket = "good" | "info" | "warning" | "critical" | "muted"

export const BUCKET_COLOR: Record<Bucket, string> = {
  good: "var(--success)",
  info: "var(--info)",
  warning: "var(--warning)",
  critical: "var(--destructive)",
  muted: "var(--muted-foreground)",
}

function IconChip({ color, icon: Icon }: { color: string; icon: React.ComponentType<{ className?: string }> }) {
  const style = {
    backgroundImage: `linear-gradient(135deg, color-mix(in oklch, ${color} 18%, transparent), color-mix(in oklch, ${color} 6%, transparent))`,
    color,
    "--tw-ring-color": `color-mix(in oklch, ${color} 20%, transparent)`,
  } as React.CSSProperties

  return (
    <div
      className="flex size-10 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset transition-transform duration-300 group-hover/card:scale-105"
      style={style}
    >
      <Icon className="size-5" />
    </div>
  )
}

/** A thin, axis-less trend strip under a KPI's value - only ever rendered when the caller has a
 * real short time series behind it (e.g. Open Tickets' own daily trend data), never a fabricated
 * shape. Most KPIs on these dashboards have no such series (a single point-in-time count has
 * nothing to plot) and simply omit this prop rather than get a fake sparkline. */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const points = data.map((value, i) => ({ i, value }))
  return (
    <div className="h-8 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="kpiSparklineFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.25} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill="url(#kpiSparklineFill)" isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

export function KpiCard({
  label,
  value,
  icon: Icon,
  bucket,
  subtitle,
  sparkline,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  bucket?: Bucket
  /** An optional supporting line under the metric (e.g. "Active: 10", "+12 this week") - omitted
   * entirely (no reserved space) when not given, so every existing call site is unaffected. */
  subtitle?: React.ReactNode
  /** An optional real short time series (e.g. this KPI's own daily counts over the selected
   * period) rendered as a small trend strip. Omit when there's no real series behind this
   * number - see Sparkline's own comment. A perfectly flat series (e.g. zero every day) is
   * still real data but conveys nothing as a "trend" - rendered as a bare horizontal line sitting
   * at the bottom of its own container, which reads as a stray rendering artifact rather than a
   * chart, so it's suppressed the same as if no sparkline had been passed at all. */
  sparkline?: number[]
}) {
  const color = bucket ? BUCKET_COLOR[bucket] : "var(--muted-foreground)"
  const display = useCountUp(value)

  return (
    <Card
      className="group/card relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg"
      style={{ borderTopWidth: 3, borderTopColor: bucket ? color : "var(--border)" }}
    >
      <CardContent className="flex flex-col gap-2 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-sm text-muted-foreground">{label}</span>
            <span className="text-xl sm:text-2xl lg:text-[1.7rem] leading-tight break-words font-semibold tracking-tight tabular-nums">
              {display.toLocaleString()}
            </span>
            {subtitle && <span className="text-xs text-muted-foreground">{subtitle}</span>}
          </div>
          <IconChip color={color} icon={Icon} />
        </div>
        {sparkline && sparkline.length > 1 && sparkline.some((v) => v !== sparkline[0]) && (
          <Sparkline data={sparkline} color={color} />
        )}
      </CardContent>
    </Card>
  )
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

// Indian compact notation (₹6.74Cr / ₹12.5L / ₹45K) - a KPI card is a fixed, narrow width, and
// the full grouped figure (₹6,74,46,116) was wrapping across three lines in that space. The
// exact value is still available via the native title tooltip on hover.
const compactCurrencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  notation: "compact",
  maximumFractionDigits: 2,
})

export function ValueKpiCard({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
}) {
  const display = useCountUp(value)

  return (
    <Card
      className="group/card relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg"
      style={{ borderTopWidth: 3, borderTopColor: "var(--success)" }}
    >
      <CardContent className="flex items-start justify-between gap-3 pt-6">
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span
            className="text-xl sm:text-2xl lg:text-[1.7rem] leading-tight truncate font-semibold tracking-tight tabular-nums"
            title={currencyFormatter.format(value)}
          >
            {compactCurrencyFormatter.format(display)}
          </span>
        </div>
        <IconChip color="var(--success)" icon={Icon} />
      </CardContent>
    </Card>
  )
}

export function KpiGridSkeleton({ count, className }: { count: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i}>
          <CardContent className="flex flex-col gap-2.5 pt-6">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-7 w-14" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
