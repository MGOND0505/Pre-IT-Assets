"use client"

import * as React from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTable } from "@/components/common/data-table"
import { Pagination } from "@/components/common/pagination"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { UserFormDialog } from "@/components/users/user-form-dialog"
import { UserStatusBadge } from "@/components/users/user-status-badge"
import { AdminResetPasswordDialog } from "@/components/users/admin-reset-password-dialog"
import { EditUserRolesDialog } from "@/components/users/edit-user-roles-dialog"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { hasPermission, PERM } from "@/lib/permissions"

type User = {
  _id: string
  name: string
  email: string
  roles: { _id: string; name: string }[]
  status: "Active" | "Inactive"
  createdDate: string
}

type PaginatedUsers = {
  items: User[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export default function UsersPage() {
  const { user: currentUser, loading: authLoading } = useAuth()
  const [data, setData] = React.useState<PaginatedUsers | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [pendingStatusChange, setPendingStatusChange] = React.useState<User | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<User | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = React.useState<User | null>(null)
  const [editRolesUser, setEditRolesUser] = React.useState<User | null>(null)

  const canView = hasPermission(currentUser, PERM.USERS_READ)
  const canCreate = hasPermission(currentUser, PERM.USERS_CREATE)
  const canWrite = hasPermission(currentUser, PERM.USERS_WRITE)
  const canDelete = hasPermission(currentUser, PERM.USERS_DELETE)
  const canManageRoles = hasPermission(currentUser, PERM.USERS_MANAGE_USERS)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<PaginatedUsers>>("/users", { params: { page, limit: 10 } })
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load users"))
    } finally {
      setLoading(false)
    }
  }, [page])

  React.useEffect(() => {
    if (canView) load()
  }, [canView, load])

  async function toggleStatus(targetUser: User) {
    const nextStatus = targetUser.status === "Active" ? "deactivate" : "activate"
    try {
      await apiClient.patch(`/users/${targetUser._id}/${nextStatus}`)
      toast.success(`${targetUser.email} ${nextStatus}d`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update user status"))
    } finally {
      setPendingStatusChange(null)
    }
  }

  async function handleDelete(targetUser: User) {
    try {
      await apiClient.delete(`/users/${targetUser._id}`)
      toast.success(`${targetUser.email} deleted`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete user"))
    } finally {
      setPendingDelete(null)
    }
  }

  const columns: ColumnDef<User, unknown>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "email", header: "Email" },
    {
      accessorKey: "roles",
      header: "Roles",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.roles.map((role) => (
            <Badge key={role._id} variant="outline">
              {role.name}
            </Badge>
          ))}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <UserStatusBadge status={row.original.status} />,
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
            {canManageRoles && (
              <DropdownMenuItem onClick={() => setEditRolesUser(row.original)}>Edit roles</DropdownMenuItem>
            )}
            {canWrite && (
              <DropdownMenuItem onClick={() => setResetPasswordUser(row.original)}>
                Reset password
              </DropdownMenuItem>
            )}
            {canWrite && (
              <DropdownMenuItem
                variant={row.original.status === "Active" ? "destructive" : "default"}
                onClick={() => setPendingStatusChange(row.original)}
              >
                {row.original.status === "Active" ? "Deactivate" : "Activate"}
              </DropdownMenuItem>
            )}
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

  if (authLoading) {
    return null
  }

  if (!canView) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have permission to view this page.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">Manage who has access to this system.</p>
        </div>
        {canCreate && <UserFormDialog onCreated={load} />}
      </div>

      <DataTable columns={columns} data={data?.items ?? []} isLoading={loading} emptyMessage="No users yet." />
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}

      {pendingStatusChange && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingStatusChange(null)}
          title={`${pendingStatusChange.status === "Active" ? "Deactivate" : "Activate"} ${pendingStatusChange.email}?`}
          description={
            pendingStatusChange.status === "Active"
              ? "They will be immediately logged out and unable to sign in until reactivated."
              : "They will be able to sign in again."
          }
          confirmLabel={pendingStatusChange.status === "Active" ? "Deactivate" : "Activate"}
          destructive={pendingStatusChange.status === "Active"}
          onConfirm={() => toggleStatus(pendingStatusChange)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingDelete(null)}
          title={`Delete ${pendingDelete.email}?`}
          description="This permanently removes the user account. This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={() => handleDelete(pendingDelete)}
        />
      )}

      {resetPasswordUser && (
        <AdminResetPasswordDialog
          open
          onOpenChange={(open) => !open && setResetPasswordUser(null)}
          userId={resetPasswordUser._id}
          userEmail={resetPasswordUser.email}
        />
      )}

      {editRolesUser && (
        <EditUserRolesDialog
          open
          onOpenChange={(open) => !open && setEditRolesUser(null)}
          userId={editRolesUser._id}
          userEmail={editRolesUser.email}
          currentRoleIds={editRolesUser.roles.map((r) => r._id)}
          onSaved={load}
        />
      )}
    </div>
  )
}
