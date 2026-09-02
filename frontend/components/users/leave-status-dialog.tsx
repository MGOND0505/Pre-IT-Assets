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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useUserOptions } from "@/lib/use-lookup-options"

export function LeaveStatusDialog({
  open,
  onOpenChange,
  userId,
  userName,
  currentBackupAgentId,
  warnBeforeSave = false,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userName: string
  currentBackupAgentId: string | null
  warnBeforeSave?: boolean
  onSaved: () => void
}) {
  const [backupAgentId, setBackupAgentId] = React.useState(currentBackupAgentId ?? "")
  const [submitting, setSubmitting] = React.useState(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)
  const { items: users } = useUserOptions()

  React.useEffect(() => {
    if (open) setBackupAgentId(currentBackupAgentId ?? "")
  }, [open, currentBackupAgentId])

  function handleSave() {
    if (!backupAgentId) {
      toast.error("Select a backup agent")
      return
    }
    if (warnBeforeSave) {
      setConfirmOpen(true)
      return
    }
    handleConfirm()
  }

  async function handleConfirm() {
    setSubmitting(true)
    try {
      const res = await apiClient.patch<ApiEnvelope<{ reassignedTicketCount: number }>>(`/users/${userId}/leave`, {
        isOnLeave: true,
        backupAgentId,
      })
      const count = res.data.data.reassignedTicketCount
      toast.success(
        count > 0
          ? `${userName} marked on leave - ${count} open ticket(s) handed over`
          : `${userName} marked on leave`
      )
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not mark user on leave"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Mark {userName} on leave</DialogTitle>
          <DialogDescription>
            Their open tickets will be immediately reassigned to the backup agent below, who will
            be notified by email. New tickets won&apos;t be auto-assigned to them while on leave.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="backup-agent">Backup agent</Label>
          <Select value={backupAgentId} onValueChange={(v) => setBackupAgentId(v ?? "")}>
            <SelectTrigger id="backup-agent" className="w-full">
              <SelectValue placeholder="Choose a backup agent" />
            </SelectTrigger>
            <SelectContent>
              {users
                .filter((u) => u._id !== userId)
                .map((u) => (
                  <SelectItem key={u._id} value={u._id}>
                    {u.name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting || !backupAgentId}>
            {submitting ? "Saving..." : "Mark on leave"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title="Confirm leave status change"
      description="This will modify an existing employee record. Review before saving."
      confirmLabel="Mark on leave"
      onConfirm={() => {
        setConfirmOpen(false)
        handleConfirm()
      }}
    />
    </>
  )
}
