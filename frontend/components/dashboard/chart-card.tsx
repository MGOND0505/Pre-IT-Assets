"use client"

import * as React from "react"
import { useTheme } from "next-themes"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

/** Shared theme-aware chart chrome (grid/axis colors, a single sequential hue) - one place
 * so every bar chart on the dashboard reads consistently in both light and dark mode. */
export function useChartTheme() {
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const isDark = mounted && resolvedTheme === "dark"

  return {
    isDark,
    gridColor: isDark ? "#2c2c2a" : "#e1e0d9",
    axisColor: "#898781",
    labelColor: isDark ? "#f5f5f4" : "#0b0b0b",
    cursorFill: isDark ? "#ffffff0d" : "#0000000a",
    sequential: isDark ? "#3987e5" : "#2a78d6",
  }
}

/** A chart's card chrome, consistent height, and empty-state message in one place - every
 * dashboard chart wraps its <ResponsiveContainer> in this instead of hand-rolling the same
 * Card/CardHeader/CardTitle/CardContent shell each time. */
export function ChartCard({
  title,
  isEmpty,
  emptyMessage,
  height = 320,
  children,
}: {
  title: string
  isEmpty: boolean
  emptyMessage: string
  height?: number
  children: React.ReactNode
}) {
  return (
    <Card className="transition-all duration-300 hover:shadow-soft-md">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent style={{ height }}>
        {isEmpty ? <p className="text-sm text-muted-foreground">{emptyMessage}</p> : children}
      </CardContent>
    </Card>
  )
}

/** A premium replacement for Recharts' default tooltip: rounded, soft-shadowed, a small
 * line-key swatch (per dataviz convention - "line keys, not boxes") tying the value back to
 * the hovered mark's own color, value set as the strong/high-contrast element. */
export function ChartTooltip({
  active,
  payload,
  label,
  color,
}: {
  active?: boolean
  payload?: { value: number; payload?: { bucket?: string } }[]
  label?: string
  color?: string | ((bucket?: string) => string)
}) {
  if (!active || !payload || payload.length === 0) return null
  const point = payload[0]
  const resolvedColor = typeof color === "function" ? color(point.payload?.bucket) : color

  return (
    <div className="min-w-32 rounded-lg border bg-popover/95 px-3 py-2 text-sm shadow-soft-lg backdrop-blur-sm">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <div className="flex items-center gap-2">
        {resolvedColor && <span className="h-2 w-3 shrink-0 rounded-full" style={{ backgroundColor: resolvedColor }} />}
        <p className="font-semibold text-popover-foreground tabular-nums">{point.value.toLocaleString()}</p>
      </div>
    </div>
  )
}
