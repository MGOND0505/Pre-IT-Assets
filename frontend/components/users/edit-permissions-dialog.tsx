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
import { useRoleOptions } from "@/lib/use-lookup-options"

type RoleChoice = "admin" | "subAdmin" | "employee"
type EmployeeTier = "subAdmin" | "employee" | null

const NO_ROLE = "__custom__"

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
  currentRoleTemplateId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userEmail: string
  currentIsAdmin: boolean
  currentEmployeeTier: EmployeeTier
  currentPermissions: PermissionsShape
  currentRoleTemplateId?: string | null
  onSaved: () => void
}) {
  const [role, setRole] = React.useState<RoleChoice>(roleOf(currentIsAdmin, currentEmployeeTier))
  const [permissions, setPermissions] = React.useState(currentPermissions ?? emptyPermissions())
  // Id of the saved Role template currently applied, or NO_ROLE - "Custom" (edit manually).
  // Starts at whatever the user's own roleTemplate already is, so re-opening this dialog shows
  // their previously-applied Role pre-selected rather than defaulting to Custom.
  const [roleTemplateId, setRoleTemplateId] = React.useState(currentRoleTemplateId || NO_ROLE)
  const [submitting, setSubmitting] = React.useState(false)

  const { items: roleOptions } = useRoleOptions(role === "admin" ? undefined : role)

  React.useEffect(() => {
    if (open) {
      setRole(roleOf(currentIsAdmin, currentEmployeeTier))
      setPermissions(currentPermissions ?? emptyPermissions())
      setRoleTemplateId(currentRoleTemplateId || NO_ROLE)
    }
  }, [open, currentIsAdmin, currentEmployeeTier, currentPermissions, currentRoleTemplateId])

  function handleRoleChange(next: RoleChoice) {
    const previousTier = roleOf(currentIsAdmin, currentEmployeeTier)
    setRole(next)
    setRoleTemplateId(NO_ROLE)
    // Only re-seed a fresh preset when actually SWITCHING into a tier - if it already matches
    // where the account started, keep their real current permissions instead of clobbering them.
    if (next !== previousTier) {
      if (next === "subAdmin") setPermissions(subAdminPermissions())
      if (next === "employee") setPermissions(basicUserPermissions())
    }
  }

  function handlePermissionsChange(next: PermissionsShape) {
    setPermissions(next)
    // A manual checkbox edit means the grid no longer matches whatever saved Role seeded it -
    // stop treating this as "apply Role X" and fall back to sending the edited matrix directly.
    setRoleTemplateId(NO_ROLE)
  }

  function handleRoleTemplateChange(value: string) {
    setRoleTemplateId(value)
    if (value === NO_ROLE) return
    const selected = roleOptions.find((r) => r._id === value)
    if (selected) setPermissions(selected.permissions)
  }

  async function handleSave() {
    setSubmitting(true)
    try {
      await apiClient.put(`/users/${userId}/permissions`, {
        isAdmin: role === "admin",
        employeeTier: role === "admin" ? null : role,
        permissions: role === "admin" ? emptyPermissions() : permissions,
        // A real id applies that Role (copy permissions+portalType, remember it); null explicitly
        // clears any previously-applied Role's traceability - always one or the other here, since
        // (unlike the create dialog) an existing user may already have a Role applied that a
        // switch back to "Custom" needs to actually detach, not just silently leave stale.
        roleId: roleTemplateId === NO_ROLE ? null : roleTemplateId,
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
        {role !== "admin" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="edit-perm-role-template">Apply a saved role (optional)</Label>
            <Select value={roleTemplateId} onValueChange={(v) => v && handleRoleTemplateChange(v)}>
              <SelectTrigger id="edit-perm-role-template" className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_ROLE}>Custom (edit manually below)</SelectItem>
                {roleOptions.map((r) => (
                  <SelectItem key={r._id} value={r._id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {role !== "admin" && <ModulePermissionGrid permissions={permissions} onPermissionsChange={handlePermissionsChange} />}
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : "Save permissions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
