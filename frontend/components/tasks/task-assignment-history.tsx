"use client"

import * as React from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"

// Mirrors components/helpdesk/ticket-assignment-history.tsx - same reconstructed-from-AuditLog
// pattern (see backend/src/modules/tasks/assignmentHistory.service.ts), adapted field names.
type TaskAssignmentHistoryEntry = {
  id: string
  action: "CREATE" | "ASSIGN"
  actorName: string
  assigneeName: string
  previousAssigneeName: string | null
  reason: string | null
  createdAt: string
}

const ACTION_LABELS: Record<TaskAssignmentHistoryEntry["action"], string> = {
  CREATE: "Assigned",
  ASSIGN: "Reassigned",
}

function describe(entry: TaskAssignmentHistoryEntry): string {
  const from = entry.previousAssigneeName ? ` (previously ${entry.previousAssigneeName})` : ""
  return `${ACTION_LABELS[entry.action]} to ${entry.assigneeName}${from}`
}

export function TaskAssignmentHistory({ taskId }: { taskId: string }) {
  const [entries, setEntries] = React.useState<TaskAssignmentHistoryEntry[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    apiClient
      .get<ApiEnvelope<TaskAssignmentHistoryEntry[]>>(`/tasks/${taskId}/assignment-history`)
      .then((res) => setEntries(res.data.data))
      .catch((err) => toast.error(apiErrorMessage(err, "Could not load assignment history")))
      .finally(() => setLoading(false))
  }, [taskId])

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
                  {entry.reason && <span className="text-xs text-muted-foreground">Reason: {entry.reason}</span>}
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
