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
import { LocationFormDialog, type Location } from "@/components/locations/location-form-dialog"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"

type Paginated = { items: Location[]; total: number; page: number; totalPages: number }

export default function LocationsPage() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = React.useState<Paginated | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [editing, setEditing] = React.useState<Location | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<Location | null>(null)

  const canView = Boolean(user?.isAdmin)
  const canCreate = Boolean(user?.isAdmin)
  const canWrite = Boolean(user?.isAdmin)
  const canDelete = Boolean(user?.isAdmin)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Paginated>>("/locations", { params: { page, limit: 10 } })
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load locations"))
    } finally {
      setLoading(false)
    }
  }, [page])

  React.useEffect(() => {
    if (canView) load()
  }, [canView, load])

  async function handleDelete(location: Location) {
    try {
      await apiClient.delete(`/locations/${location._id}`)
      toast.success(`${location.name} deleted`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete location"))
    } finally {
      setPendingDelete(null)
    }
  }

  const columns: ColumnDef<Location, unknown>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "city", header: "City" },
    { accessorKey: "country", header: "Country" },
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
              <Button variant="ghost" size="icon">
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Locations</h1>
          <p className="text-sm text-muted-foreground">Manage the physical locations used across the system.</p>
        </div>
        {canCreate && <LocationFormDialog onSaved={load} />}
      </div>

      <DataTable columns={columns} data={data?.items ?? []} isLoading={loading} emptyMessage="No locations yet." />
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}

      {editing && (
        <LocationFormDialog
          location={editing}
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
