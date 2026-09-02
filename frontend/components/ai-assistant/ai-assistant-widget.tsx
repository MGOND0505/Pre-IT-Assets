"use client"

import * as React from "react"
import Link from "next/link"
import { X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { AiAssistantChat } from "@/components/ai-assistant/ai-assistant-chat"
import { AiAssistantIcon, AiAssistantLogo } from "@/components/ai-assistant/ai-assistant-logo"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

/**
 * A persistent, bottom-left floating launcher for the AI Assistant, mounted once in the
 * dashboard shell (`app/[org]/(dashboard)/layout.tsx`) so it's reachable from every page in the
 * app, not just its own `/ai-assistant` page - matching the "AI Assistant available everywhere"
 * requirement. Gated the same way the nav entry and the full page are: hidden entirely if this
 * user's `aiAssistant.view` permission is off (an admin can toggle it per user or per role).
 *
 * Deliberately its own fixed-position panel rather than a modal `Dialog` - unlike the Command
 * Palette (a blocking quick-navigation overlay), this is meant to stay open alongside whatever
 * page the user is already working in, the same way a typical chat-widget launcher behaves.
 */
export function AiAssistantWidget() {
  const { user } = useAuth()
  const toOrgHref = useOrgHref()
  const [open, setOpen] = React.useState(false)

  if (!can(user, "aiAssistant", "view")) return null

  return (
    <div className="fixed bottom-6 left-6 z-40 flex flex-col items-start gap-3">
      {open && (
        <div className="flex w-[380px] max-w-[calc(100vw-3rem)] flex-col gap-2 rounded-xl bg-popover p-3 text-popover-foreground shadow-soft-lg ring-1 ring-foreground/10 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95">
          <div className="flex items-center justify-between px-1">
            <div className="flex flex-col gap-0.5">
              <AiAssistantLogo textClassName="text-sm" />
              <Link
                href={toOrgHref("/ai-assistant")}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                onClick={() => setOpen(false)}
              >
                Open full page
              </Link>
            </div>
            <Button variant="ghost" size="icon" aria-label="Close AI Assistant" onClick={() => setOpen(false)}>
              <X className="size-4" />
            </Button>
          </div>
          <AiAssistantChat panelHeightClassName="h-[420px]" />
        </div>
      )}

      <Button
        size="icon"
        className="size-12 rounded-full shadow-soft-lg"
        aria-label={open ? "Close AI Assistant" : "Open AI Assistant"}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? <X className="size-5" /> : <AiAssistantIcon className="size-6" />}
      </Button>
    </div>
  )
}
