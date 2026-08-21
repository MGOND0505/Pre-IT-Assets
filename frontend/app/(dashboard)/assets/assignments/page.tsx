"use client"

import * as React from "react"
import Link from "next/link"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { DataTable } from "@/components/common/data-table"
import { Pagination } from "@/components/common/pagination"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { hasPermission, PERM } from "@/lib/permissions"

type RefOption = { _id: string; name?: string; email?: string } | null

type Assignment = {
  _id: string
  asset: { _id: string; assetId: string; name: string } | null
  assignedTo: RefOption
  department: RefOption
  location: RefOption
  assignedDate: string
  returnedDate: string | null
  remarks: string
}

type Paginated = { items: Assignment[]; total: number; page: number; totalPages: number }

export default function AssetAssignmentsPage() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = React.useState<Paginated | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)

  const canView = hasPermission(user, PERM.ASSETS_READ)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Paginated>>("/asset-assignments", { params: { page, limit: 20 } })
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load assignments"))
    } finally {
      setLoading(false)
    }
  }, [page])

  React.useEffect(() => {
    if (canView) load()
  }, [canView, load])

  const columns: ColumnDef<Assignment, unknown>[] = [
    {
      accessorKey: "asset",
      header: "Asset",
      cell: ({ row }) =>
        row.original.asset ? (
          <Link href={`/assets/${row.original.asset._id}`} className="font-medium text-primary hover:underline">
            {row.original.asset.assetId}
          </Link>
        ) : (
          "-"
        ),
    },
    { accessorKey: "assignedTo", header: "Assigned to", cell: ({ row }) => row.original.assignedTo?.name ?? "-" },
    { accessorKey: "department", header: "Department", cell: ({ row }) => row.original.department?.name ?? "-" },
    { accessorKey: "location", header: "Location", cell: ({ row }) => row.original.location?.name ?? "-" },
    {
      accessorKey: "assignedDate",
      header: "Assigned",
      cell: ({ row }) => new Date(row.original.assignedDate).toLocaleDateString(),
    },
    {
      accessorKey: "returnedDate",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.returnedDate ? "secondary" : "default"}>
          {row.original.returnedDate ? "Returned" : "Active"}
        </Badge>
      ),
    },
  ]

  if (authLoading) return null
  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Asset Assignments</h1>
        <p className="text-sm text-muted-foreground">Every assignment, active and historical.</p>
      </div>
      <DataTable columns={columns} data={data?.items ?? []} isLoading={loading} emptyMessage="No assignments yet." />
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}
    </div>
  )
}
