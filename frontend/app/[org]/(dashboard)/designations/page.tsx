"use client"

import * as React from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTable } from "@/components/common/data-table"
import { Pagination } from "@/components/common/pagination"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { DesignationFormDialog, type Designation } from "@/components/designations/designation-form-dialog"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"

type Paginated = { items: Designation[]; total: number; page: number; totalPages: number }

export default function DesignationsPage() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = React.useState<Paginated | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [editing, setEditing] = React.useState<Designation | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<Designation | null>(null)

  const canView = can(user, "designations", "view")
  const canCreate = can(user, "designations", "create")
  const canWrite = can(user, "designations", "update")
  const canDelete = can(user, "designations", "delete")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Paginated>>("/designations", { params: { page, limit: 10 } })
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load designations"))
    } finally {
      setLoading(false)
    }
  }, [page])

  React.useEffect(() => {
    if (canView) load()
  }, [canView, load])

  async function handleDelete(designation: Designation) {
    try {
      await apiClient.delete(`/designations/${designation._id}`)
      toast.success(`${designation.name} deleted`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete designation"))
    } finally {
      setPendingDelete(null)
    }
  }

  const columns: ColumnDef<Designation, unknown>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span title={row.original.name} className="block min-w-[110px] max-w-[180px] whitespace-normal break-words">
          {row.original.name}
        </span>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      meta: { hideBelow: "md" },
      cell: ({ row }) => (
        <span title={row.original.description} className="block min-w-[200px] max-w-[360px] whitespace-normal break-words">
          {row.original.description || "-"}
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
          <h1 className="text-2xl font-semibold tracking-tight">Designations</h1>
          <p className="text-sm text-muted-foreground">Manage the job designations used across the system.</p>
        </div>
        {canCreate && <DesignationFormDialog onSaved={load} />}
      </div>

      <DataTable columns={columns} data={data?.items ?? []} isLoading={loading} emptyMessage="No designations yet." />
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}

      {editing && (
        <DesignationFormDialog
          designation={editing}
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
