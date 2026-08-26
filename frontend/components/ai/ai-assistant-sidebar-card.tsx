"use client"

import { Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

/**
 * The sidebar's own entry point into the AI Assistant - lives inside the nav itself (between
 * the nav list and the sidebar footer) rather than a separate floating button, per the
 * reference design. Decoupled from the actual assistant panel (rendered once at the dashboard
 * layout's root, not inside the sidebar - the sidebar itself re-mounts a second time inside the
 * mobile nav drawer, so it can't own the panel's state) via the same "dispatch a window event,
 * the real component listens for it" pattern CommandPaletteTrigger already uses for Cmd/Ctrl+K.
 */
export function AiAssistantSidebarCard({ eventName, description }: { eventName: string; description: string }) {
  return (
    <div className="mx-3 mb-3 flex shrink-0 flex-col gap-3 rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-4">
      <div className="flex items-center gap-2">
        <span
          className="flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-full"
          style={{ backgroundImage: "linear-gradient(135deg, var(--ai-from), var(--ai-to))" }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ai-logo.png" alt="" className="size-full object-cover" />
        </span>
        <span className="flex-1 text-sm font-semibold text-sidebar-foreground">AI Assistant</span>
        <Badge variant="outline" className="border-sidebar-border text-[10px] text-sidebar-foreground/70">
          Beta
        </Badge>
      </div>
      <p className="text-xs leading-relaxed text-sidebar-foreground/60">{description}</p>
      <Button type="button" size="sm" className="w-full" onClick={() => window.dispatchEvent(new CustomEvent(eventName))}>
        <Sparkles className="size-3.5" />
        Open Assistant
      </Button>
    </div>
  )
}
