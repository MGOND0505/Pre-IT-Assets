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
import { AssetCriticalityBadge, ASSET_CRITICALITY_LEVELS, type AssetCriticality } from "@/components/assets/asset-criticality-badge"
import { AssetCategoryTree, type AssetCategorySelection } from "@/components/assets/asset-category-tree"
import { apiClient, apiErrorMessage, orgScopedApiUrl, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useAssetCategoryOptions } from "@/lib/use-lookup-options"
import { useOrgHref } from "@/lib/use-org-href"

type RefOption = { _id: string; name: string } | null

type Asset = {
  _id: string
  assetId: string
  assetTag: string
  name: string
  category: { _id: string; name: string; prefix: string } | null
  manufacturer: string
  model: string
  serialNumber: string
  CPU: string
  ram: string
  storage: string
  display: string
  hostname: string
  macAddress: string
  adapterSerialNumber: string
  operatingSystem: string
  osVersion: string
  remarks: string
  domainName: string
  antivirusStatus: string
  ownershipType: AssetOwnershipType
  criticality: AssetCriticality
  status: AssetStatus
  location: RefOption
  department: RefOption
  vendor: RefOption
  assignedUser: (RefOption & { email?: string }) | null
  purchaseDate: string | null
  warrantyEndDate: string | null
}

type Paginated = { items: Asset[]; total: number; page: number; totalPages: number }

const ALL = "__all__"

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "-"
}

function textColumn(key: keyof Asset, header: string, hideBelow?: "sm" | "md" | "lg"): ColumnDef<Asset, unknown> {
  return {
    id: key,
    header,
    meta: hideBelow ? { hideBelow } : undefined,
    cell: ({ row }) => {
      const value = row.original[key]
      return (
        <span title={String(value ?? "")} className="block min-w-[100px] max-w-[160px] whitespace-normal break-words">
          {(value as string) || "-"}
        </span>
      )
    },
  }
}

function refColumn(key: "location" | "department" | "vendor", header: string, hideBelow?: "sm" | "md" | "lg"): ColumnDef<Asset, unknown> {
  return {
    id: key,
    header,
    meta: hideBelow ? { hideBelow } : undefined,
    cell: ({ row }) => {
      const ref = row.original[key]
      return (
        <span title={ref?.name} className="block min-w-[100px] max-w-[160px] whitespace-normal break-words">
          {ref?.name ?? "-"}
        </span>
      )
    },
  }
}

// Every key an AssetCategory.listColumns entry can name - mirrors ASSET_LIST_COLUMN_OPTIONS in
// asset-category-form-dialog.tsx (the config UI's field catalog). Keys not in this map are
// silently dropped, so a category curated before a column type existed never crashes the list.
const ASSET_COLUMN_BUILDERS: Record<string, () => ColumnDef<Asset, unknown>> = {
  category: () => ({
    id: "category",
    header: "Category",
    meta: { hideBelow: "md" },
    cell: ({ row }) => (
      <span title={row.original.category?.name} className="block min-w-[100px] max-w-[140px] whitespace-normal break-words">
        {row.original.category?.name ?? "-"}
      </span>
    ),
  }),
  manufacturer: () => textColumn("manufacturer", "Manufacturer", "md"),
  model: () => textColumn("model", "Model", "md"),
  serialNumber: () => textColumn("serialNumber", "Serial number", "lg"),
  status: () => ({
    id: "status",
    header: "Status",
    cell: ({ row }) => <AssetStatusBadge status={row.original.status} />,
  }),
  ownershipType: () => ({
    id: "ownershipType",
    header: "Ownership",
    meta: { hideBelow: "md" },
    cell: ({ row }) => <AssetOwnershipBadge ownershipType={row.original.ownershipType} />,
  }),
  criticality: () => ({
    id: "criticality",
    header: "Criticality",
    meta: { hideBelow: "lg" },
    cell: ({ row }) => <AssetCriticalityBadge criticality={row.original.criticality} />,
  }),
  location: () => refColumn("location", "Location", "md"),
  department: () => refColumn("department", "Department", "lg"),
  vendor: () => refColumn("vendor", "Vendor", "lg"),
  assignedUser: () => ({
    id: "assignedUser",
    header: "Assigned to",
    meta: { hideBelow: "md" },
    cell: ({ row }) => (
      <span
        title={row.original.assignedUser?.name}
        className="block min-w-[100px] max-w-[160px] whitespace-normal break-words"
      >
        {row.original.assignedUser?.name ?? "Unassigned"}
      </span>
    ),
  }),
  purchaseDate: () => ({
    id: "purchaseDate",
    header: "Purchase date",
    meta: { hideBelow: "lg" },
    cell: ({ row }) => formatDate(row.original.purchaseDate),
  }),
  warrantyEndDate: () => ({
    id: "warrantyEndDate",
    header: "Warranty end",
    meta: { hideBelow: "lg" },
    cell: ({ row }) => formatDate(row.original.warrantyEndDate),
  }),
  CPU: () => textColumn("CPU", "CPU", "lg"),
  ram: () => textColumn("ram", "RAM", "lg"),
  storage: () => textColumn("storage", "Storage", "lg"),
  display: () => textColumn("display", "Display", "lg"),
  hostname: () => textColumn("hostname", "Hostname", "lg"),
  macAddress: () => textColumn("macAddress", "MAC address", "lg"),
  adapterSerialNumber: () => textColumn("adapterSerialNumber", "Adapter serial number", "lg"),
  operatingSystem: () => textColumn("operatingSystem", "Operating system", "lg"),
  osVersion: () => textColumn("osVersion", "OS version", "lg"),
  remarks: () => textColumn("remarks", "Remarks", "lg"),
  domainName: () => textColumn("domainName", "Domain name", "lg"),
  antivirusStatus: () => textColumn("antivirusStatus", "Antivirus status", "lg"),
}

// The list's standard column set, used whenever the list isn't filtered to exactly one category,
// or that category never curated its own listColumns (null - the uncurated default).
const DEFAULT_LIST_COLUMN_KEYS = ["category", "manufacturer", "model", "location", "ownershipType", "criticality", "status"]

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
  const [categorySelection, setCategorySelection] = React.useState<AssetCategorySelection>({ group: null, category: null })
  const [criticality, setCriticality] = React.useState<string>(() => {
    const fromUrl = searchParams.get("criticality")
    return fromUrl && (ASSET_CRITICALITY_LEVELS as readonly string[]).includes(fromUrl) ? fromUrl : ALL
  })
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
          category: categorySelection.category ?? undefined,
          group: categorySelection.category ? undefined : categorySelection.group ?? undefined,
          criticality: criticality === ALL ? undefined : criticality,
        },
      })
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load assets"))
    } finally {
      setLoading(false)
    }
  }, [page, search, status, categorySelection, criticality])

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

  // Only swaps in a category's curated columns while the list is filtered to exactly that one
  // category - a group filter or "All Assets" always uses the standard set, since a mixed list of
  // categories has no single curated column set to show.
  const selectedCategoryObj = categorySelection.category
    ? categories.find((c) => c._id === categorySelection.category)
    : null
  const middleColumnKeys = selectedCategoryObj?.listColumns ?? DEFAULT_LIST_COLUMN_KEYS
  const middleColumns = middleColumnKeys
    .map((key) => ASSET_COLUMN_BUILDERS[key]?.())
    .filter((c): c is ColumnDef<Asset, unknown> => Boolean(c))

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
    ...middleColumns,
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

      <div className="flex flex-col gap-6 md:flex-row">
        <AssetCategoryTree
          categories={categories}
          selection={categorySelection}
          onChange={(next) => {
            setPage(1)
            setCategorySelection(next)
          }}
          buildAddAssetHref={canCreate ? (categoryId) => toOrgHref(`/assets/add?category=${categoryId}`) : undefined}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-6">
          <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
            <Input
              placeholder="Search by asset ID, employee, serial, hostname, IP, MAC..."
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
              value={criticality}
              onValueChange={(v) => {
                setPage(1)
                setCriticality(v ?? ALL)
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Criticality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All criticalities</SelectItem>
                {ASSET_CRITICALITY_LEVELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
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
        </div>
      </div>

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
