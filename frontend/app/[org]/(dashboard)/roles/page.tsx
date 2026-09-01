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
import { RoleFormDialog, type Role } from "@/components/roles/role-form-dialog"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can, PERMISSION_MODULES } from "@/lib/permissions"

type Paginated = { items: Role[]; total: number; page: number; totalPages: number }

const PORTAL_TYPE_LABELS: Record<Role["portalType"], string> = {
  subAdmin: "Sub Admin",
  employee: "Employee",
}

// Same shape as users/page.tsx's own permissionSummary - "N of M modules" rather than listing
// every granted action, kept short for a table cell.
function permissionSummary(role: Role): string {
  const grantedModules = PERMISSION_MODULES.filter((moduleKey) => Object.values(role.permissions[moduleKey]).some(Boolean))
  if (grantedModules.length === 0) return "No access"
  return `${grantedModules.length} of ${PERMISSION_MODULES.length} modules`
}

export default function RolesPage() {
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = React.useState<Paginated | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [editing, setEditing] = React.useState<Role | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<Role | null>(null)

  const canView = can(user, "roles", "view")
  const canCreate = can(user, "roles", "create")
  const canWrite = can(user, "roles", "update")
  const canDelete = can(user, "roles", "delete")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Paginated>>("/roles", { params: { page, limit: 10 } })
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load roles"))
    } finally {
      setLoading(false)
    }
  }, [page])

  React.useEffect(() => {
    if (canView) load()
  }, [canView, load])

  async function handleDelete(role: Role) {
    try {
      await apiClient.delete(`/roles/${role._id}`)
      toast.success(`${role.name} deleted`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete role"))
    } finally {
      setPendingDelete(null)
    }
  }

  const columns: ColumnDef<Role, unknown>[] = [
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
        <span title={row.original.description} className="block min-w-[180px] max-w-[320px] whitespace-normal break-words">
          {row.original.description || "-"}
        </span>
      ),
    },
    {
      id: "portalType",
      header: "Portal Type",
      cell: ({ row }) => <Badge variant="secondary">{PORTAL_TYPE_LABELS[row.original.portalType]}</Badge>,
    },
    {
      id: "permissions",
      header: "Access",
      cell: ({ row }) => <Badge variant="outline">{permissionSummary(row.original)}</Badge>,
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
          <h1 className="text-2xl font-semibold tracking-tight">Roles & Permissions</h1>
          <p className="text-sm text-muted-foreground">
            Define reusable named permission templates to apply to Sub Admin and Employee users.
          </p>
        </div>
        {canCreate && <RoleFormDialog onSaved={load} />}
      </div>

      <DataTable columns={columns} data={data?.items ?? []} isLoading={loading} emptyMessage="No roles yet." />
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}

      {editing && (
        <RoleFormDialog
          role={editing}
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
          description="Users this role was previously applied to keep their current permissions - only future assignment is affected. This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={() => handleDelete(pendingDelete)}
        />
      )}
    </div>
  )
}
