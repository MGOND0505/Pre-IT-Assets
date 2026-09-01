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
import { PasswordRequirementsHint } from "@/components/auth/password-requirements-hint"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { isPasswordValid, BASELINE_POLICY } from "@/lib/password-policy"

export function AdminResetPasswordDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userEmail: string
}) {
  const { user } = useAuth()
  const policy = user?.passwordPolicy ?? BASELINE_POLICY
  const [newPassword, setNewPassword] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  async function handleReset() {
    if (!isPasswordValid(newPassword, policy)) {
      toast.error("Password does not meet the requirements")
      return
    }

    setSubmitting(true)
    try {
      await apiClient.patch(`/users/${userId}/reset-password`, { newPassword })
      toast.success(`Password reset for ${userEmail}`)
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
          <DialogTitle>Reset password for {userEmail}</DialogTitle>
          <DialogDescription>
            They will be required to change this password at their next login.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="admin-new-password">New temporary password</Label>
          <Input
            id="admin-new-password"
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <PasswordRequirementsHint password={newPassword} policy={policy} />
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
