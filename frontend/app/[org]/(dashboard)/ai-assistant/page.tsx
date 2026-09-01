"use client"

import { Sparkles } from "lucide-react"

import { AiAssistantChat } from "@/components/ai-assistant/ai-assistant-chat"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"

export default function AiAssistantPage() {
  const { user, loading: authLoading } = useAuth()
  const canView = can(user, "aiAssistant", "view")

  if (authLoading) return null
  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Sparkles className="size-5 text-primary" />
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Assistant</h1>
          <p className="text-sm text-muted-foreground">
            Ask about assets, licenses, or tickets - or describe an issue and I can draft a ticket for you.
          </p>
        </div>
      </div>

      <AiAssistantChat panelHeightClassName="h-[65vh]" />
    </div>
  )
}
