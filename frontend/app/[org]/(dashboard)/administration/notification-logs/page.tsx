"use client"

import * as React from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/common/data-table"
import { Pagination } from "@/components/common/pagination"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"

type NotificationLogEntry = {
  _id: string
  channel: string
  to: string[]
  cc: string[]
  bcc: string[]
  subject: string
  status: "sent" | "failed"
  error: string
  createdDate: string
}

type Paginated = { items: NotificationLogEntry[]; total: number; page: number; totalPages: number }

const CHANNEL_LABEL: Record<string, string> = {
  smtp: "SMTP",
  microsoft365: "Microsoft 365",
  google: "Google Workspace",
  console: "Console (not configured)",
}

export default function NotificationLogsPage() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = React.useState<Paginated | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)

  const canView = can(user, "settings", "view")

  React.useEffect(() => {
    if (!canView) return
    setLoading(true)
    apiClient
      .get<ApiEnvelope<Paginated>>("/settings/notification-logs", { params: { page, limit: 20 } })
      .then((res) => setData(res.data.data))
      .catch((err) => toast.error(apiErrorMessage(err, "Could not load notification logs")))
      .finally(() => setLoading(false))
  }, [canView, page])

  const columns: ColumnDef<NotificationLogEntry, unknown>[] = [
    {
      accessorKey: "createdDate",
      header: "When",
      cell: ({ row }) => new Date(row.original.createdDate).toLocaleString(),
    },
    {
      accessorKey: "channel",
      header: "Channel",
      cell: ({ row }) => CHANNEL_LABEL[row.original.channel] ?? row.original.channel,
    },
    { accessorKey: "subject", header: "Subject" },
    {
      accessorKey: "to",
      header: "Recipients",
      cell: ({ row }) => row.original.to.join(", "),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "failed" ? "destructive" : "outline"}>
          {row.original.status === "failed" ? "Failed" : "Sent"}
        </Badge>
      ),
    },
    {
      accessorKey: "error",
      header: "Error",
      cell: ({ row }) => <span className="text-xs text-destructive">{row.original.error}</span>,
    },
  ]

  if (authLoading) return null

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notification Logs</h1>
        <p className="text-sm text-muted-foreground">
          Delivery status for every alert email attempt - test emails, expiry digests, and asset-change alerts.
        </p>
      </div>
      <DataTable columns={columns} data={data?.items ?? []} isLoading={loading} emptyMessage="No notifications sent yet." />
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}
    </div>
  )
}
