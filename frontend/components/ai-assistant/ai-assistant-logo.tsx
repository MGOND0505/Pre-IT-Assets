"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * The AI Assistant's mascot icon - a friendly, geometric robot head, gradient-filled with this
 * app's existing `--ai-from`/`--ai-to` AI-accent pair (see globals.css's "AI-native visual
 * language" utilities, already used by the dashboard's AI Insights card and the AI Assistant
 * chat surfaces) so it reads as part of the same design system rather than a new, unrelated
 * color. Pure SVG - crisp at any size, no raster asset to ship or keep in sync across
 * desktop/tablet/mobile.
 *
 * `useId()` gives each rendered instance its own gradient id - a hardcoded id would collide if
 * this icon renders more than once on the same page (nav + floating widget + page header, all
 * at once is the common case here).
 */
export function AiAssistantIcon({ className }: { className?: string }) {
  const gradientId = React.useId()
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("size-5", className)} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="var(--ai-from)" />
          <stop offset="1" stopColor="var(--ai-to)" />
        </linearGradient>
      </defs>
      {/* antenna */}
      <circle cx="12" cy="2.9" r="1.3" fill={`url(#${gradientId})`} />
      <line
        x1="12"
        y1="4.2"
        x2="12"
        y2="6.4"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.3"
        strokeLinecap="round"
      />
      {/* ears */}
      <rect x="2.4" y="10.2" width="2.3" height="5" rx="1.15" fill={`url(#${gradientId})`} />
      <rect x="19.3" y="10.2" width="2.3" height="5" rx="1.15" fill={`url(#${gradientId})`} />
      {/* head */}
      <rect x="5" y="6.4" width="14" height="13" rx="5" fill={`url(#${gradientId})`} />
      {/* recessed face plate */}
      <rect x="7.2" y="9.4" width="9.6" height="7.4" rx="3.3" fill="var(--card)" opacity="0.94" />
      {/* eyes */}
      <circle cx="9.95" cy="12.9" r="1.15" fill={`url(#${gradientId})`} />
      <circle cx="14.05" cy="12.9" r="1.15" fill={`url(#${gradientId})`} />
      {/* smile */}
      <path
        d="M9.9 15.3c0.75 0.8 2.4 0.8 4.2 0"
        stroke={`url(#${gradientId})`}
        strokeWidth="1.1"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

/** The full lockup - icon + "AI Assistant" wordmark - for prominent placements (page headers,
 * the floating widget's expanded panel, dashboard cards). Use `AiAssistantIcon` alone for tight
 * spaces (nav rail, compact buttons). */
export function AiAssistantLogo({
  className,
  iconClassName,
  textClassName,
}: {
  className?: string
  iconClassName?: string
  textClassName?: string
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <AiAssistantIcon className={cn("size-6 shrink-0", iconClassName)} />
      <span className={cn("font-semibold tracking-tight ai-gradient-text", textClassName)}>AI Assistant</span>
    </span>
  )
}
