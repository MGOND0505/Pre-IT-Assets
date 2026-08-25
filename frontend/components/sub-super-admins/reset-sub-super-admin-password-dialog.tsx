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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient, apiErrorMessage } from "@/lib/api-client"

export function ResetSubSuperAdminPasswordDialog({
  open,
  onOpenChange,
  subSuperAdminId,
  subSuperAdminEmail,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subSuperAdminId: string
  subSuperAdminEmail: string
}) {
  const [newPassword, setNewPassword] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  async function handleReset() {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }
    setSubmitting(true)
    try {
      await apiClient.patch(`/sub-super-admins/${subSuperAdminId}/reset-password`, { newPassword })
      toast.success(`Password reset for ${subSuperAdminEmail}`)
      setNewPassword("")
      onOpenChange(false)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not reset password"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset password for {subSuperAdminEmail}</DialogTitle>
          <DialogDescription>They will be required to change this password at their next login.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ssa-new-password">New temporary password</Label>
          <Input
            id="ssa-new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button onClick={handleReset} disabled={submitting}>
            {submitting ? "Resetting..." : "Reset password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
