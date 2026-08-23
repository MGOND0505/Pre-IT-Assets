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
import { EditPermissionsDialog } from "@/components/users/edit-permissions-dialog"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import type { PermissionsShape } from "@/lib/permissions"

type User = {
  _id: string
  name: string
  email: string
  employeeId?: string
  department: { _id: string; name: string } | null
  isAdmin: boolean
  permissions: PermissionsShape
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

function permissionSummary(user: User): string {
  if (user.isAdmin) return "Admin (all)"
  const parts: string[] = []
  for (const area of ["assets", "licenses"] as const) {
    const p = user.permissions[area]
    const actions = (["read", "add", "edit", "delete"] as const).filter((a) => p[a])
    if (actions.length > 0) parts.push(`${area}:${actions.join(",")}`)
  }
  if (user.permissions.reports.read) parts.push("reports:read")
  return parts.length > 0 ? parts.join(" ") : "No access"
}

export default function UsersPage() {
  const { user: currentUser, loading: authLoading } = useAuth()
  const [data, setData] = React.useState<PaginatedUsers | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [pendingStatusChange, setPendingStatusChange] = React.useState<User | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<User | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = React.useState<User | null>(null)
  const [editPermissionsUser, setEditPermissionsUser] = React.useState<User | null>(null)

  const canManage = Boolean(currentUser?.isAdmin)

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
    if (canManage) load()
  }, [canManage, load])

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
      accessorKey: "department",
      header: "Department",
      cell: ({ row }) => row.original.department?.name ?? "-",
    },
    {
      id: "permissions",
      header: "Access",
      cell: ({ row }) => (
        <Badge variant={row.original.isAdmin ? "default" : "outline"}>{permissionSummary(row.original)}</Badge>
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
            <DropdownMenuItem onClick={() => setEditPermissionsUser(row.original)}>Edit permissions</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setResetPasswordUser(row.original)}>Reset password</DropdownMenuItem>
            <DropdownMenuItem
              variant={row.original.status === "Active" ? "destructive" : "default"}
              onClick={() => setPendingStatusChange(row.original)}
            >
              {row.original.status === "Active" ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(row.original)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  if (authLoading) {
    return null
  }

  if (!canManage) {
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
          <p className="text-sm text-muted-foreground">Manage who has access to this system and what they can do.</p>
        </div>
        <UserFormDialog onCreated={load} />
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

      {editPermissionsUser && (
        <EditPermissionsDialog
          open
          onOpenChange={(open) => !open && setEditPermissionsUser(null)}
          userId={editPermissionsUser._id}
          userEmail={editPermissionsUser.email}
          currentIsAdmin={editPermissionsUser.isAdmin}
          currentPermissions={editPermissionsUser.permissions}
          onSaved={load}
        />
      )}
    </div>
  )
}
