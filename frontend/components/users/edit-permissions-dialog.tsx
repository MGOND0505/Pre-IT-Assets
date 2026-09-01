"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ModulePermissionGrid, basicUserPermissions, subAdminPermissions } from "@/components/users/permission-grid"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { emptyPermissions, type PermissionsShape } from "@/lib/permissions"

type RoleChoice = "admin" | "subAdmin" | "employee"
type EmployeeTier = "subAdmin" | "employee" | null

function roleOf(isAdmin: boolean, employeeTier: EmployeeTier): RoleChoice {
  if (isAdmin) return "admin"
  // null covers every pre-existing account created before this field existed - treated
  // identically to "subAdmin" everywhere else in the app, so default the picker there too.
  return employeeTier === "employee" ? "employee" : "subAdmin"
}

export function EditPermissionsDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
  currentIsAdmin,
  currentEmployeeTier,
  currentPermissions,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userEmail: string
  currentIsAdmin: boolean
  currentEmployeeTier: EmployeeTier
  currentPermissions: PermissionsShape
  onSaved: () => void
}) {
  const [role, setRole] = React.useState<RoleChoice>(roleOf(currentIsAdmin, currentEmployeeTier))
  const [permissions, setPermissions] = React.useState(currentPermissions ?? emptyPermissions())
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setRole(roleOf(currentIsAdmin, currentEmployeeTier))
      setPermissions(currentPermissions ?? emptyPermissions())
    }
  }, [open, currentIsAdmin, currentEmployeeTier, currentPermissions])

  function handleRoleChange(next: RoleChoice) {
    const previousTier = roleOf(currentIsAdmin, currentEmployeeTier)
    setRole(next)
    // Only re-seed a fresh preset when actually SWITCHING into a tier - if it already matches
    // where the account started, keep their real current permissions instead of clobbering them.
    if (next !== previousTier) {
      if (next === "subAdmin") setPermissions(subAdminPermissions())
      if (next === "employee") setPermissions(basicUserPermissions())
    }
  }

  async function handleSave() {
    setSubmitting(true)
    try {
      await apiClient.put(`/users/${userId}/permissions`, {
        isAdmin: role === "admin",
        employeeTier: role === "admin" ? null : role,
        permissions: role === "admin" ? emptyPermissions() : permissions,
      })
      toast.success(`Permissions updated for ${userEmail}`)
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update permissions"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>Edit permissions for {userEmail}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="edit-perm-role">Role</Label>
          <Select value={role} onValueChange={(v) => handleRoleChange(v as RoleChoice)}>
            <SelectTrigger id="edit-perm-role" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="subAdmin">Sub Admin</SelectItem>
              <SelectItem value="employee">Employee</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {role !== "admin" && <ModulePermissionGrid permissions={permissions} onPermissionsChange={setPermissions} />}
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : "Save permissions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
