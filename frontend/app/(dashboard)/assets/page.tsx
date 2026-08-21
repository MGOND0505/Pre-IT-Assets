"use client"

import * as React from "react"
import Link from "next/link"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/common/data-table"
import { Pagination } from "@/components/common/pagination"
import { AssetStatusBadge, ASSET_STATUSES, type AssetStatus } from "@/components/assets/asset-status-badge"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { hasPermission, PERM } from "@/lib/permissions"
import { useAssetCategoryOptions } from "@/lib/use-lookup-options"

type Asset = {
  _id: string
  assetId: string
  name: string
  category: { _id: string; name: string; prefix: string } | null
  manufacturer: string
  model: string
  status: AssetStatus
  location: { _id: string; name: string } | null
}

type Paginated = { items: Asset[]; total: number; page: number; totalPages: number }

const ALL = "__all__"

export default function AssetsPage() {
  const { user, loading: authLoading } = useAuth()
  const { items: categories } = useAssetCategoryOptions()
  const [data, setData] = React.useState<Paginated | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<string>(ALL)
  const [category, setCategory] = React.useState<string>(ALL)

  const canView = hasPermission(user, PERM.ASSETS_READ)
  const canCreate = hasPermission(user, PERM.ASSETS_CREATE)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Paginated>>("/assets", {
        params: {
          page,
          limit: 10,
          search: search || undefined,
          status: status === ALL ? undefined : status,
          category: category === ALL ? undefined : category,
        },
      })
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load assets"))
    } finally {
      setLoading(false)
    }
  }, [page, search, status, category])

  React.useEffect(() => {
    if (canView) load()
  }, [canView, load])

  const columns: ColumnDef<Asset, unknown>[] = [
    {
      accessorKey: "assetId",
      header: "Asset ID",
      cell: ({ row }) => (
        <Link href={`/assets/${row.original._id}`} className="font-medium text-primary hover:underline">
          {row.original.assetId}
        </Link>
      ),
    },
    { accessorKey: "name", header: "Name" },
    {
      accessorKey: "category",
      header: "Category",
      cell: ({ row }) => row.original.category?.name ?? "-",
    },
    { accessorKey: "manufacturer", header: "Manufacturer" },
    { accessorKey: "model", header: "Model" },
    {
      accessorKey: "location",
      header: "Location",
      cell: ({ row }) => row.original.location?.name ?? "-",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <AssetStatusBadge status={row.original.status} />,
    },
  ]

  if (authLoading) return null
  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">All Assets</h1>
          <p className="text-sm text-muted-foreground">Search, filter, and manage every IT asset.</p>
        </div>
        {canCreate && (
          <Button render={<Link href="/assets/add" />}>Add Asset</Button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search by asset ID, serial, hostname, IP, MAC..."
          value={search}
          onChange={(e) => {
            setPage(1)
            setSearch(e.target.value)
          }}
          className="max-w-sm"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setPage(1)
            setStatus(v ?? ALL)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {ASSET_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={category}
          onValueChange={(v) => {
            setPage(1)
            setCategory(v ?? ALL)
          }}
        >
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {categories.map((c) => (
              <SelectItem key={c._id} value={c._id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={data?.items ?? []} isLoading={loading} emptyMessage="No assets yet." />
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}
    </div>
  )
}
