"use client"

import * as React from "react"
import { toast } from "sonner"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { UserStatusBadge } from "@/components/users/user-status-badge"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"

type RoleUser = { _id: string; name: string; email: string; status: "Active" | "Inactive" }

export function UsersByRoleDialog({
  open,
  onOpenChange,
  roleId,
  roleName,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  roleId: string
  roleName: string
}) {
  const [users, setUsers] = React.useState<RoleUser[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (!open) return
    setLoading(true)
    apiClient
      .get<ApiEnvelope<RoleUser[]>>(`/roles/${roleId}/users`)
      .then((res) => setUsers(res.data.data))
      .catch((err) => toast.error(apiErrorMessage(err, "Could not load users")))
      .finally(() => setLoading(false))
  }, [open, roleId])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Users with the &quot;{roleName}&quot; role</DialogTitle>
          <DialogDescription>{users.length} user(s) currently hold this role.</DialogDescription>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : users.length === 0 ? (
          <p className="text-sm text-muted-foreground">No users hold this role.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {users.map((u) => (
              <li key={u._id} className="flex items-center justify-between rounded-md border p-2 text-sm">
                <div className="flex flex-col">
                  <span className="font-medium">{u.name}</span>
                  <span className="text-muted-foreground">{u.email}</span>
                </div>
                <UserStatusBadge status={u.status} />
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  )
}
