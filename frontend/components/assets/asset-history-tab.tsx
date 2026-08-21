"use client"

import * as React from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"

type HistoryEntry = {
  _id: string
  action: string
  user: { name: string; email: string } | null
  remarks: string
  createdAt: string
}

export function AssetHistoryTab({ assetId }: { assetId: string }) {
  const [entries, setEntries] = React.useState<HistoryEntry[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    apiClient
      .get<ApiEnvelope<HistoryEntry[]>>(`/assets/${assetId}/history`)
      .then((res) => setEntries(res.data.data))
      .catch((err) => toast.error(apiErrorMessage(err, "Could not load history")))
      .finally(() => setLoading(false))
  }, [assetId])

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>
  if (entries.length === 0) return <p className="text-sm text-muted-foreground">No activity recorded yet.</p>

  return (
    <ol className="flex flex-col gap-3">
      {entries.map((entry) => (
        <li key={entry._id} className="flex gap-3 rounded-md border p-3 text-sm">
          <Badge variant="outline" className="h-fit shrink-0">
            {entry.action}
          </Badge>
          <div className="flex flex-col gap-0.5">
            <span>{entry.remarks || <span className="text-muted-foreground">No remarks</span>}</span>
            <span className="text-xs text-muted-foreground">
              {entry.user?.name ?? "System"} &middot; {new Date(entry.createdAt).toLocaleString()}
            </span>
          </div>
        </li>
      ))}
    </ol>
  )
}
