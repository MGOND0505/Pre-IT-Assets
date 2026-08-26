"use client"

import Link from "next/link"
import { Bell, CheckCircle2 } from "lucide-react"

function AttentionChip({ label, count, href, color }: { label: string; count: number; href: string; color: string }) {
  if (count === 0) return null
  return (
    <Link
      href={href}
      className="group flex items-center gap-2 rounded-full border bg-background px-3 py-1.5 text-sm shadow-soft-sm transition-all hover:-translate-y-0.5 hover:shadow-soft-md"
    >
      <span
        className="flex size-5 items-center justify-center rounded-full text-xs font-semibold text-white tabular-nums"
        style={{ backgroundColor: color }}
      >
        {count > 99 ? "99+" : count}
      </span>
      <span className="text-foreground">{label}</span>
    </Link>
  )
}

export function AttentionBanner({
  items,
  loading,
}: {
  items: { label: string; count: number; href: string; color: string }[]
  /** Skips rendering entirely while the underlying stats are still loading, so this never
   * briefly flashes "all clear" before the real (possibly non-zero) counts arrive. */
  loading?: boolean
}) {
  if (loading) return null

  const hasItems = items.some((item) => item.count > 0)

  if (!hasItems) {
    return (
      <div className="flex items-center gap-2.5 rounded-xl border border-success/25 bg-success/5 p-4 text-sm">
        <CheckCircle2 className="size-4 shrink-0 text-success" />
        <span className="font-medium text-foreground">All clear</span>
        <span className="text-muted-foreground">Nothing needs your attention right now.</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-500/30 bg-gradient-to-br from-amber-500/8 via-amber-500/5 to-transparent p-4">
      <div className="flex items-center gap-2 text-sm font-medium">
        <span className="relative flex size-4">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-500/50" />
          <Bell className="relative size-4 text-amber-600" />
        </span>
        Needs your attention
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map((item) => (
          <AttentionChip key={item.label} {...item} />
        ))}
      </div>
    </div>
  )
}
