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
import { PermissionGrid } from "@/components/users/permission-grid"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { emptyPermissions, type PermissionsShape } from "@/lib/permissions"

export function EditPermissionsDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
  currentIsAdmin,
  currentPermissions,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userEmail: string
  currentIsAdmin: boolean
  currentPermissions: PermissionsShape
  onSaved: () => void
}) {
  const [isAdmin, setIsAdmin] = React.useState(currentIsAdmin)
  const [permissions, setPermissions] = React.useState(currentPermissions ?? emptyPermissions())
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setIsAdmin(currentIsAdmin)
      setPermissions(currentPermissions ?? emptyPermissions())
    }
  }, [open, currentIsAdmin, currentPermissions])

  async function handleSave() {
    setSubmitting(true)
    try {
      await apiClient.put(`/users/${userId}/permissions`, { isAdmin, permissions })
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
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit permissions for {userEmail}</DialogTitle>
        </DialogHeader>
        <PermissionGrid
          isAdmin={isAdmin}
          onIsAdminChange={setIsAdmin}
          permissions={permissions}
          onPermissionsChange={setPermissions}
        />
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : "Save permissions"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
