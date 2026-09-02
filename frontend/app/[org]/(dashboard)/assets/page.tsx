"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { MagneticButton } from "@/components/ui/magnetic-button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/common/data-table"
import { Pagination } from "@/components/common/pagination"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { AssetStatusBadge, ASSET_STATUSES, type AssetStatus } from "@/components/assets/asset-status-badge"
import { AssetOwnershipBadge, type AssetOwnershipType } from "@/components/assets/asset-ownership-badge"
import { apiClient, apiErrorMessage, orgScopedApiUrl, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useAssetCategoryOptions } from "@/lib/use-lookup-options"
import { useOrgHref } from "@/lib/use-org-href"

type Asset = {
  _id: string
  assetId: string
  name: string
  category: { _id: string; name: string; prefix: string } | null
  manufacturer: string
  model: string
  ownershipType: AssetOwnershipType
  status: AssetStatus
  location: { _id: string; name: string } | null
}

type Paginated = { items: Asset[]; total: number; page: number; totalPages: number }

const ALL = "__all__"

export default function AssetsPage() {
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()
  const { items: categories } = useAssetCategoryOptions()
  const [data, setData] = React.useState<Paginated | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  // Pre-filters from a dashboard drill-down link (e.g. clicking "Under Repair" on the Assets by
  // status chart) - read once on mount so the list opens already scoped to what was clicked.
  const [status, setStatus] = React.useState<string>(() => {
    const fromUrl = searchParams.get("status")
    return fromUrl && (ASSET_STATUSES as readonly string[]).includes(fromUrl) ? fromUrl : ALL
  })
  const [category, setCategory] = React.useState<string>(ALL)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [confirmingBulkDelete, setConfirmingBulkDelete] = React.useState(false)
  const [bulkDeleting, setBulkDeleting] = React.useState(false)

  const canView = can(user, "assets", "view")
  const canCreate = can(user, "assets", "create")
  const canBulkDelete = Boolean(user?.isAdmin)
  // Row selection itself isn't admin-only: any user who can re-import (assets:add) may want
  // to select a subset, download it as CSV, edit it, and re-upload to update just those rows.
  const canSelectRows = canBulkDelete || canCreate

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
    setSelectedIds(new Set())
  }, [canView, load])

  function toggleRow(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function toggleAllOnPage(checked: boolean) {
    const idsOnPage = data?.items.map((a) => a._id) ?? []
    setSelectedIds((prev) => {
      const next = new Set(prev)
      for (const id of idsOnPage) {
        if (checked) next.add(id)
        else next.delete(id)
      }
      return next
    })
  }

  async function handleBulkDelete() {
    setBulkDeleting(true)
    try {
      const res = await apiClient.post<ApiEnvelope<{ deleted: number }>>("/assets/bulk-delete", {
        ids: Array.from(selectedIds),
      })
      toast.success(`${res.data.data.deleted} asset(s) deleted`)
      setSelectedIds(new Set())
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete the selected assets"))
    } finally {
      setBulkDeleting(false)
      setConfirmingBulkDelete(false)
    }
  }

  function handleDownloadCsv() {
    window.open(orgScopedApiUrl(`/reports/assets/export?format=csv`), "_blank")
  }

  function handleDownloadSelectedCsv() {
    const ids = Array.from(selectedIds).join(",")
    window.open(orgScopedApiUrl(`/reports/assets/export?format=csv&ids=${encodeURIComponent(ids)}`), "_blank")
  }

  const idsOnPage = data?.items.map((a) => a._id) ?? []
  const allOnPageSelected = idsOnPage.length > 0 && idsOnPage.every((id) => selectedIds.has(id))

  const columns: ColumnDef<Asset, unknown>[] = [
    ...(canSelectRows
      ? ([
          {
            id: "select",
            header: () => (
              <Checkbox
                checked={allOnPageSelected}
                onCheckedChange={(checked) => toggleAllOnPage(checked === true)}
                aria-label="Select all on this page"
              />
            ),
            cell: ({ row }) => (
              <Checkbox
                checked={selectedIds.has(row.original._id)}
                onCheckedChange={(checked) => toggleRow(row.original._id, checked === true)}
                aria-label={`Select ${row.original.assetId}`}
              />
            ),
          } satisfies ColumnDef<Asset, unknown>,
        ] as ColumnDef<Asset, unknown>[])
      : []),
    {
      accessorKey: "assetId",
      header: "Asset ID",
      cell: ({ row }) => (
        <Link
          href={toOrgHref(`/assets/${row.original._id}`)}
          title={row.original.assetId}
          className="block min-w-[90px] max-w-[130px] font-medium text-primary whitespace-normal break-words hover:underline"
        >
          {row.original.assetId}
        </Link>
      ),
    },
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span title={row.original.name} className="block min-w-[140px] max-w-[220px] whitespace-normal break-words">
          {row.original.name}
        </span>
      ),
    },
    {
      accessorKey: "category",
      header: "Category",
      meta: { hideBelow: "md" },
      cell: ({ row }) => (
        <span
          title={row.original.category?.name}
          className="block min-w-[100px] max-w-[140px] whitespace-normal break-words"
        >
          {row.original.category?.name ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "manufacturer",
      header: "Manufacturer",
      meta: { hideBelow: "md" },
      cell: ({ row }) => (
        <span
          title={row.original.manufacturer}
          className="block min-w-[100px] max-w-[140px] whitespace-normal break-words"
        >
          {row.original.manufacturer || "-"}
        </span>
      ),
    },
    {
      accessorKey: "model",
      header: "Model",
      meta: { hideBelow: "md" },
      cell: ({ row }) => (
        <span title={row.original.model} className="block min-w-[110px] max-w-[150px] whitespace-normal break-words">
          {row.original.model || "-"}
        </span>
      ),
    },
    {
      accessorKey: "location",
      header: "Location",
      meta: { hideBelow: "md" },
      cell: ({ row }) => (
        <span
          title={row.original.location?.name}
          className="block min-w-[120px] max-w-[170px] whitespace-normal break-words"
        >
          {row.original.location?.name ?? "-"}
        </span>
      ),
    },
    {
      accessorKey: "ownershipType",
      header: "Ownership",
      meta: { hideBelow: "md" },
      cell: ({ row }) => <AssetOwnershipBadge ownershipType={row.original.ownershipType} />,
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">All Assets</h1>
          <p className="text-sm text-muted-foreground">Search, filter, and manage every IT asset.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleDownloadCsv}>
            Download CSV
          </Button>
          {canCreate && (
            <MagneticButton>
              <Button render={<Link href={toOrgHref("/assets/add")} />}>Add Asset</Button>
            </MagneticButton>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <Input
          placeholder="Search by asset ID, employee, serial, IMEI, hostname, IP, MAC..."
          value={search}
          onChange={(e) => {
            setPage(1)
            setSearch(e.target.value)
          }}
          className="w-full md:max-w-sm"
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

        {selectedIds.size > 0 && (
          <Button variant="outline" onClick={handleDownloadSelectedCsv}>
            Download selected as CSV ({selectedIds.size})
          </Button>
        )}
        {canBulkDelete && selectedIds.size > 0 && (
          <Button variant="destructive" onClick={() => setConfirmingBulkDelete(true)}>
            Delete selected ({selectedIds.size})
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={loading}
        emptyMessage="No assets yet."
        onRowClick={(asset) => router.push(toOrgHref(`/assets/${asset._id}`))}
      />
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}

      {confirmingBulkDelete && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setConfirmingBulkDelete(false)}
          title={`Delete ${selectedIds.size} asset(s)?`}
          description="These will be soft-deleted and can be recovered by an Admin. This action affects all selected assets."
          confirmLabel={bulkDeleting ? "Deleting..." : "Delete"}
          destructive
          onConfirm={handleBulkDelete}
        />
      )}
    </div>
  )
}
