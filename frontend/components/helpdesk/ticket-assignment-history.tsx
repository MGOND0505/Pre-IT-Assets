"use client"

import * as React from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"

type AssignmentHistoryEntry = {
  id: string
  action: "ASSIGN" | "REASSIGN" | "AUTO_ASSIGN" | "ESCALATE"
  actorName: string
  agentName: string
  previousAgentName: string | null
  tier: string | null
  createdAt: string
}

const ACTION_LABELS: Record<AssignmentHistoryEntry["action"], string> = {
  ASSIGN: "Assigned",
  REASSIGN: "Reassigned",
  AUTO_ASSIGN: "Auto-Assigned",
  ESCALATE: "Escalated",
}

// AUTO_ASSIGN entries are historical only - Support Teams (and the round-robin auto-assignment
// they drove) have been removed, so no new entries with this action are created going forward.
function describe(entry: AssignmentHistoryEntry): string {
  const from = entry.previousAgentName ? ` (previously ${entry.previousAgentName})` : ""
  if (entry.action === "AUTO_ASSIGN") {
    return `Auto-assigned to ${entry.agentName}`
  }
  if (entry.action === "ESCALATE") {
    return `Escalated to ${entry.tier ?? "next tier"} after breaching its SLA`
  }
  return `${ACTION_LABELS[entry.action]} to ${entry.agentName}${from}`
}

export function TicketAssignmentHistory({ ticketId }: { ticketId: string }) {
  const [entries, setEntries] = React.useState<AssignmentHistoryEntry[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    apiClient
      .get<ApiEnvelope<AssignmentHistoryEntry[]>>(`/helpdesk/${ticketId}/assignment-history`)
      .then((res) => setEntries(res.data.data))
      .catch((err) => toast.error(apiErrorMessage(err, "Could not load assignment history")))
      .finally(() => setLoading(false))
  }, [ticketId])

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 pt-6">
        <h2 className="text-sm font-semibold text-muted-foreground">Assignment History</h2>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!loading && entries.length === 0 && (
          <p className="text-sm text-muted-foreground">No assignment activity recorded yet.</p>
        )}
        {entries.length > 0 && (
          <ol className="flex flex-col gap-3">
            {entries.map((entry) => (
              <li key={entry.id} className="flex gap-3 rounded-md border p-3 text-sm">
                <Badge variant="outline" className="h-fit shrink-0">
                  {ACTION_LABELS[entry.action]}
                </Badge>
                <div className="flex flex-col gap-0.5">
                  <span>{describe(entry)}</span>
                  <span className="text-xs text-muted-foreground">
                    {entry.actorName} &middot; {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
