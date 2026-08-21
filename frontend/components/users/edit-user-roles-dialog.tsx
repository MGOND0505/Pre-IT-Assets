"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { RoleCheckboxList } from "@/components/roles/role-checkbox-list"
import { apiClient, apiErrorMessage } from "@/lib/api-client"

export function EditUserRolesDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
  currentRoleIds,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userEmail: string
  currentRoleIds: string[]
  onSaved: () => void
}) {
  const [roleIds, setRoleIds] = React.useState<string[]>(currentRoleIds)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    setRoleIds(currentRoleIds)
  }, [currentRoleIds])

  async function handleSave() {
    if (roleIds.length === 0) {
      toast.error("At least one role is required")
      return
    }

    setSubmitting(true)
    try {
      await apiClient.put(`/users/${userId}/roles`, { roleIds })
      toast.success(`Roles updated for ${userEmail}`)
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update roles"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit roles for {userEmail}</DialogTitle>
          <DialogDescription>
            Changes take effect on their next request - no need for them to log out.
          </DialogDescription>
        </DialogHeader>
        <RoleCheckboxList value={roleIds} onChange={setRoleIds} />
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : "Save roles"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
