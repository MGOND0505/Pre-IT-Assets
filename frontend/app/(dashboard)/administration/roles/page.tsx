"use client"

import * as React from "react"
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
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { RoleFormDialog } from "@/components/roles/role-form-dialog"
import { UsersByRoleDialog } from "@/components/roles/users-by-role-dialog"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { hasPermission, PERM } from "@/lib/permissions"
import { useRoles, type RoleOption } from "@/lib/use-roles"

export default function RolesPage() {
  const { user, loading: authLoading } = useAuth()
  const { roles, loading, reload } = useRoles()
  const [editingRole, setEditingRole] = React.useState<RoleOption | null>(null)
  const [viewingUsersOf, setViewingUsersOf] = React.useState<RoleOption | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<RoleOption | null>(null)

  const canView = hasPermission(user, PERM.ROLES_READ)
  const canCreate = hasPermission(user, PERM.ROLES_CREATE)
  const canWrite = hasPermission(user, PERM.ROLES_WRITE)
  const canDelete = hasPermission(user, PERM.ROLES_DELETE)

  async function handleDelete(role: RoleOption) {
    try {
      await apiClient.delete(`/roles/${role._id}`)
      toast.success(`${role.name} deleted`)
      reload()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete role"))
    } finally {
      setPendingDelete(null)
    }
  }

  if (authLoading) return null

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Roles &amp; Permissions</h1>
          <p className="text-sm text-muted-foreground">
            Create roles and control exactly which actions each one can perform, per module.
          </p>
        </div>
        {canCreate && <RoleFormDialog onSaved={reload} />}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading roles...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <div key={role._id} className="flex flex-col gap-3 rounded-lg border p-4">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{role.name}</span>
                    {role.isSystem && (
                      <Badge variant="outline" className="text-[10px]">
                        Built-in
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">{role.description}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="ghost" size="icon">
                        <MoreHorizontal className="size-4" />
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setViewingUsersOf(role)}>View users</DropdownMenuItem>
                    {canWrite && <DropdownMenuItem onClick={() => setEditingRole(role)}>Edit</DropdownMenuItem>}
                    {canDelete && !role.isSystem && (
                      <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(role)}>
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span>{role.isSuperAdmin ? "All permissions" : `${role.permissions.length} permission(s)`}</span>
                <span>&middot;</span>
                <span>
                  {role.userCount} user{role.userCount === 1 ? "" : "s"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {editingRole && (
        <RoleFormDialog
          role={editingRole}
          open
          onOpenChange={(open) => !open && setEditingRole(null)}
          onSaved={() => {
            reload()
            setEditingRole(null)
          }}
        />
      )}

      {viewingUsersOf && (
        <UsersByRoleDialog
          open
          onOpenChange={(open) => !open && setViewingUsersOf(null)}
          roleId={viewingUsersOf._id}
          roleName={viewingUsersOf.name}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingDelete(null)}
          title={`Delete role "${pendingDelete.name}"?`}
          description="This cannot be undone. Roles still assigned to a user cannot be deleted."
          confirmLabel="Delete"
          destructive
          onConfirm={() => handleDelete(pendingDelete)}
        />
      )}
    </div>
  )
}
