"use client"

import * as React from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTable } from "@/components/common/data-table"
import { Pagination } from "@/components/common/pagination"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { VendorFormDialog, type Vendor } from "@/components/vendors/vendor-form-dialog"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"

type Paginated = { items: Vendor[]; total: number; page: number; totalPages: number }

export default function VendorsPage() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = React.useState<Paginated | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<"Active" | "Inactive" | "">("")
  const [editing, setEditing] = React.useState<Vendor | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<Vendor | null>(null)

  const canView = can(user, "vendors", "view")
  const canCreate = can(user, "vendors", "create")
  const canWrite = can(user, "vendors", "update")
  const canDelete = can(user, "vendors", "delete")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Paginated>>("/vendors", {
        params: { page, limit: 10, search: search || undefined, status: status || undefined },
      })
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load vendors"))
    } finally {
      setLoading(false)
    }
  }, [page, search, status])

  React.useEffect(() => {
    if (canView) load()
  }, [canView, load])

  async function handleDelete(vendor: Vendor) {
    try {
      await apiClient.delete(`/vendors/${vendor._id}`)
      toast.success(`${vendor.name} deleted`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete vendor"))
    } finally {
      setPendingDelete(null)
    }
  }

  const columns: ColumnDef<Vendor, unknown>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span title={row.original.name} className="block min-w-[110px] max-w-[170px] whitespace-normal break-words">
          {row.original.name}
        </span>
      ),
    },
    {
      accessorKey: "contactPerson",
      header: "Contact",
      meta: { hideBelow: "md" },
      cell: ({ row }) => (
        <span title={row.original.contactPerson} className="block min-w-[100px] max-w-[150px] whitespace-normal break-words">
          {row.original.contactPerson || "-"}
        </span>
      ),
    },
    {
      accessorKey: "service",
      header: "Service",
      meta: { hideBelow: "lg" },
      cell: ({ row }) => (
        <span title={row.original.service} className="block min-w-[120px] max-w-[200px] whitespace-normal break-words">
          {row.original.service || "-"}
        </span>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      meta: { hideBelow: "md" },
      cell: ({ row }) => (
        <span title={row.original.email} className="block min-w-[140px] max-w-[220px] whitespace-normal break-words">
          {row.original.email || "-"}
        </span>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "Active" ? "default" : "secondary"}>{row.original.status}</Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Row actions">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {canWrite && <DropdownMenuItem onClick={() => setEditing(row.original)}>Edit</DropdownMenuItem>}
            {canDelete && (
              <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(row.original)}>
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
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
          <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
          <p className="text-sm text-muted-foreground">Manage the vendors used across the system.</p>
        </div>
        {canCreate && <VendorFormDialog onSaved={load} />}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search by name, contact, or email..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="max-w-xs"
        />
        <Select
          value={status || "all"}
          onValueChange={(v) => {
            setStatus(v === "all" ? "" : (v as "Active" | "Inactive"))
            setPage(1)
          }}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="Active">Active</SelectItem>
            <SelectItem value="Inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={data?.items ?? []} isLoading={loading} emptyMessage="No vendors yet." />
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}

      {editing && (
        <VendorFormDialog
          vendor={editing}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={() => {
            load()
            setEditing(null)
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingDelete(null)}
          title={`Delete "${pendingDelete.name}"?`}
          description="This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={() => handleDelete(pendingDelete)}
        />
      )}
    </div>
  )
}
