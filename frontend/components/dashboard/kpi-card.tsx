"use client"

import * as React from "react"
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

export function KpiCard({
  label,
  value,
  icon: Icon,
  bucket,
}: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  bucket?: Bucket
}) {
  const color = bucket ? BUCKET_COLOR[bucket] : "var(--muted-foreground)"
  const display = useCountUp(value)

  return (
    <Card
      className="group/card relative overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-soft-lg"
      style={{ borderTopWidth: 3, borderTopColor: bucket ? color : "var(--border)" }}
    >
      <CardContent className="flex items-start justify-between gap-3 pt-6">
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-[1.7rem] leading-none font-semibold tracking-tight tabular-nums">
            {display.toLocaleString()}
          </span>
        </div>
        <IconChip color={color} icon={Icon} />
      </CardContent>
    </Card>
  )
}

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
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
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-[1.7rem] leading-none font-semibold tracking-tight tabular-nums">
            {currencyFormatter.format(display)}
          </span>
        </div>
        <IconChip color="var(--success)" icon={Icon} />
      </CardContent>
    </Card>
  )
}

export function KpiGridSkeleton({ count, className }: { count: number; className?: string }) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7", className)}>
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
