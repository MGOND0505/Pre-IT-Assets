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
import { LicenseStatusBadge, LicenseExpiryBadge, LICENSE_STATUSES } from "@/components/licenses/license-status-badge"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

type License = {
  _id: string
  licenseId: string
  softwareName: string
  vendor: { _id: string; name: string } | null
  totalLicenses: number
  assignedUsers: { _id: string; name: string }[]
  expiryDate: string | null
  status: "Active" | "Expired" | "Cancelled"
}

type Paginated = { items: License[]; total: number; page: number; totalPages: number }

const ALL = "__all__"

export default function LicensesPage() {
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = React.useState<Paginated | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<string>(ALL)

  const canView = can(user, "licenses", "view")
  const canCreate = can(user, "licenses", "create")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Paginated>>("/licenses", {
        params: {
          page,
          limit: 10,
          search: search || undefined,
          status: status === ALL ? undefined : status,
        },
      })
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load licenses"))
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  React.useEffect(() => {
    if (canView) load()
  }, [canView, load])

  const columns: ColumnDef<License, unknown>[] = [
    {
      accessorKey: "licenseId",
      header: "License ID",
      cell: ({ row }) => (
        <Link href={toOrgHref(`/licenses/${row.original._id}`)} className="font-medium text-primary hover:underline">
          {row.original.licenseId}
        </Link>
      ),
    },
    { accessorKey: "softwareName", header: "Software" },
    {
      accessorKey: "vendor",
      header: "Vendor",
      cell: ({ row }) => row.original.vendor?.name ?? "-",
    },
    {
      id: "seats",
      header: "Used / Total",
      cell: ({ row }) => `${row.original.assignedUsers.length} / ${row.original.totalLicenses}`,
    },
    {
      accessorKey: "expiryDate",
      header: "Expiry",
      cell: ({ row }) => <LicenseExpiryBadge expiryDate={row.original.expiryDate} />,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <LicenseStatusBadge status={row.original.status} />,
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
          <h1 className="text-2xl font-semibold tracking-tight">All Licenses</h1>
          <p className="text-sm text-muted-foreground">Search, filter, and manage every software license.</p>
        </div>
        {canCreate && <Button render={<Link href={toOrgHref("/licenses/add")} />}>Add License</Button>}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <Input
          placeholder="Search by license ID, software, publisher..."
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
            {LICENSE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={data?.items ?? []} isLoading={loading} emptyMessage="No licenses yet." />
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}
    </div>
  )
}
