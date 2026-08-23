"use client"

import * as React from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/common/data-table"
import { Pagination } from "@/components/common/pagination"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"

type LoginHistoryEntry = {
  _id: string
  emailAttempted: string
  action: "login_success" | "login_failed" | "logout"
  reason: string | null
  ipAddress: string | null
  createdAt: string
}

type Paginated = { items: LoginHistoryEntry[]; total: number; page: number; totalPages: number }

const ACTION_LABEL: Record<LoginHistoryEntry["action"], string> = {
  login_success: "Login success",
  login_failed: "Login failed",
  logout: "Logout",
}

export default function LoginHistoryPage() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = React.useState<Paginated | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)

  const canView = Boolean(user?.isAdmin)

  React.useEffect(() => {
    if (!canView) return
    setLoading(true)
    apiClient
      .get<ApiEnvelope<Paginated>>("/login-history", { params: { page, limit: 20 } })
      .then((res) => setData(res.data.data))
      .catch((err) => toast.error(apiErrorMessage(err, "Could not load login history")))
      .finally(() => setLoading(false))
  }, [canView, page])

  const columns: ColumnDef<LoginHistoryEntry, unknown>[] = [
    {
      accessorKey: "createdAt",
      header: "When",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
    },
    { accessorKey: "emailAttempted", header: "Email" },
    {
      accessorKey: "action",
      header: "Event",
      cell: ({ row }) => (
        <Badge variant={row.original.action === "login_failed" ? "destructive" : "outline"}>
          {ACTION_LABEL[row.original.action]}
        </Badge>
      ),
    },
    { accessorKey: "reason", header: "Reason" },
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
        <h1 className="text-2xl font-semibold tracking-tight">Login History</h1>
        <p className="text-sm text-muted-foreground">Successful logins, failed attempts, and logouts.</p>
      </div>
      <DataTable columns={columns} data={data?.items ?? []} isLoading={loading} emptyMessage="No login activity yet." />
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}
    </div>
  )
}
