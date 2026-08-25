"use client"

import Link from "next/link"
import { Bell } from "lucide-react"

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
}: {
  items: { label: string; count: number; href: string; color: string }[]
}) {
  const hasItems = items.some((item) => item.count > 0)
  if (!hasItems) return null

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
