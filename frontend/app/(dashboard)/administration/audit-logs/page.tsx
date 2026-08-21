"use client"

import * as React from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { DataTable } from "@/components/common/data-table"
import { Pagination } from "@/components/common/pagination"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { hasPermission, PERM } from "@/lib/permissions"

type AuditLog = {
  _id: string
  action: string
  module: string
  recordLabel: string | null
  userSnapshot: { name: string | null; email: string | null; role: string | null }
  ipAddress: string | null
  createdAt: string
}

type Paginated = { items: AuditLog[]; total: number; page: number; totalPages: number }

export default function AuditLogsPage() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = React.useState<Paginated | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)

  const canView = hasPermission(user, PERM.AUDIT_READ)

  React.useEffect(() => {
    if (!canView) return
    setLoading(true)
    apiClient
      .get<ApiEnvelope<Paginated>>("/audit-logs", { params: { page, limit: 20 } })
      .then((res) => setData(res.data.data))
      .catch((err) => toast.error(apiErrorMessage(err, "Could not load audit logs")))
      .finally(() => setLoading(false))
  }, [canView, page])

  const columns: ColumnDef<AuditLog, unknown>[] = [
    {
      accessorKey: "createdAt",
      header: "When",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
    },
    {
      accessorKey: "userSnapshot",
      header: "User",
      cell: ({ row }) => row.original.userSnapshot?.email ?? "System",
    },
    { accessorKey: "action", header: "Action" },
    { accessorKey: "module", header: "Module" },
    { accessorKey: "recordLabel", header: "Record" },
    { accessorKey: "ipAddress", header: "IP" },
  ]

  if (authLoading) {
    return null
  }

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">
          Every create, update, assign, and delete action, for accountability. Read-only.
        </p>
      </div>
      <DataTable columns={columns} data={data?.items ?? []} isLoading={loading} emptyMessage="No audit entries yet." />
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}
    </div>
  )
}
