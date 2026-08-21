"use client"

import * as React from "react"
import Link from "next/link"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { DataTable } from "@/components/common/data-table"
import { Pagination } from "@/components/common/pagination"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { hasPermission, PERM } from "@/lib/permissions"

type RefOption = { _id: string; name?: string; email?: string } | null

type Transfer = {
  _id: string
  asset: { _id: string; assetId: string; name: string } | null
  fromUser: RefOption
  toUser: RefOption
  fromLocation: RefOption
  toLocation: RefOption
  reason: string
  createdDate: string
}

type Paginated = { items: Transfer[]; total: number; page: number; totalPages: number }

export default function AssetTransfersPage() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = React.useState<Paginated | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)

  const canView = hasPermission(user, PERM.ASSETS_READ)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Paginated>>("/asset-transfers", { params: { page, limit: 20 } })
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load transfers"))
    } finally {
      setLoading(false)
    }
  }, [page])

  React.useEffect(() => {
    if (canView) load()
  }, [canView, load])

  const columns: ColumnDef<Transfer, unknown>[] = [
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
    { accessorKey: "fromUser", header: "From", cell: ({ row }) => row.original.fromUser?.name ?? "-" },
    { accessorKey: "toUser", header: "To", cell: ({ row }) => row.original.toUser?.name ?? "-" },
    { accessorKey: "fromLocation", header: "From location", cell: ({ row }) => row.original.fromLocation?.name ?? "-" },
    { accessorKey: "toLocation", header: "To location", cell: ({ row }) => row.original.toLocation?.name ?? "-" },
    { accessorKey: "reason", header: "Reason" },
    {
      accessorKey: "createdDate",
      header: "Date",
      cell: ({ row }) => new Date(row.original.createdDate).toLocaleDateString(),
    },
  ]

  if (authLoading) return null
  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Asset Transfers</h1>
        <p className="text-sm text-muted-foreground">Every asset transfer between people, locations, or departments.</p>
      </div>
      <DataTable columns={columns} data={data?.items ?? []} isLoading={loading} emptyMessage="No transfers yet." />
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}
    </div>
  )
}
