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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { hasPermission, PERM } from "@/lib/permissions"
import { useAuth } from "@/lib/auth-context"
import {
  useDepartmentOptions,
  useLocationOptions,
  useUserOptions,
} from "@/lib/use-lookup-options"

const NONE = "__none__"

function UserSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { items } = useUserOptions()
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(!v || v === NONE ? "" : v)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a person" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Unassigned</SelectItem>
        {items.map((u) => (
          <SelectItem key={u._id} value={u._id}>
            {u.name} ({u.email})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function LocationSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { items } = useLocationOptions()
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(!v || v === NONE ? "" : v)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a location" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Unchanged</SelectItem>
        {items.map((l) => (
          <SelectItem key={l._id} value={l._id}>
            {l.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function DepartmentSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { items } = useDepartmentOptions()
  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(!v || v === NONE ? "" : v)}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select a department" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>Unchanged</SelectItem>
        {items.map((d) => (
          <SelectItem key={d._id} value={d._id}>
            {d.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function AssignDialog({
  assetId,
  open,
  onOpenChange,
  onDone,
}: {
  assetId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const [assignedTo, setAssignedTo] = React.useState("")
  const [department, setDepartment] = React.useState("")
  const [location, setLocation] = React.useState("")
  const [remarks, setRemarks] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await apiClient.post(`/assets/${assetId}/assign`, {
        assignedTo: assignedTo || undefined,
        department: department || undefined,
        location: location || undefined,
        remarks,
      })
      toast.success("Asset assigned")
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not assign asset"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Assign asset</DialogTitle>
          <DialogDescription>Any currently active assignment will be closed as reassigned.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>Assign to</Label>
            <UserSelect value={assignedTo} onChange={setAssignedTo} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Department</Label>
            <DepartmentSelect value={department} onChange={setDepartment} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>Location</Label>
            <LocationSelect value={location} onChange={setLocation} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="assign-remarks">Remarks</Label>
            <Input id="assign-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Assigning..." : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function TransferDialog({
  assetId,
  open,
  onOpenChange,
  onDone,
}: {
  assetId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const [toUser, setToUser] = React.useState("")
  const [toLocation, setToLocation] = React.useState("")
  const [toDepartment, setToDepartment] = React.useState("")
  const [reason, setReason] = React.useState("")
  const [remarks, setRemarks] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await apiClient.post(`/assets/${assetId}/transfer`, {
        toUser: toUser || undefined,
        toLocation: toLocation || undefined,
        toDepartment: toDepartment || undefined,
        reason,
        remarks,
      })
      toast.success("Asset transferred")
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not transfer asset"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Transfer asset</DialogTitle>
          <DialogDescription>Leave a field unchanged to keep its current value.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label>New assignee</Label>
            <UserSelect value={toUser} onChange={setToUser} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>New location</Label>
            <LocationSelect value={toLocation} onChange={setToLocation} />
          </div>
          <div className="flex flex-col gap-2">
            <Label>New department</Label>
            <DepartmentSelect value={toDepartment} onChange={setToDepartment} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="transfer-reason">Reason</Label>
            <Input id="transfer-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="transfer-remarks">Remarks</Label>
            <Input id="transfer-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Transferring..." : "Transfer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ReturnDialog({
  assetId,
  open,
  onOpenChange,
  onDone,
}: {
  assetId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const [remarks, setRemarks] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await apiClient.post(`/assets/${assetId}/return`, { remarks })
      toast.success("Asset returned")
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not return asset"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Return asset</DialogTitle>
          <DialogDescription>Clears the current assignee and sets status to Available.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="return-remarks">Remarks</Label>
          <Input id="return-remarks" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Returning..." : "Return"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function RetireDialog({
  assetId,
  open,
  onOpenChange,
  onDone,
}: {
  assetId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onDone: () => void
}) {
  const [reason, setReason] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSubmit() {
    setSubmitting(true)
    try {
      await apiClient.post(`/assets/${assetId}/retire`, { reason })
      toast.success("Asset retired")
      onOpenChange(false)
      onDone()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not retire asset"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Retire asset</DialogTitle>
          <DialogDescription>This closes any active assignment and sets status to Retired.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="retire-reason">Reason</Label>
          <Input id="retire-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Retiring..." : "Retire"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AssetWorkflowActions({ assetId, onDone }: { assetId: string; onDone: () => void }) {
  const { user } = useAuth()
  const [openDialog, setOpenDialog] = React.useState<"assign" | "transfer" | "return" | "retire" | null>(null)

  const canAssign = hasPermission(user, PERM.ASSETS_ASSIGN)
  const canTransfer = hasPermission(user, PERM.ASSETS_TRANSFER)
  const canRetire = hasPermission(user, PERM.ASSETS_RETIRE)

  return (
    <>
      <div className="flex gap-2">
        {canAssign && (
          <Button variant="outline" onClick={() => setOpenDialog("assign")}>
            Assign
          </Button>
        )}
        {canTransfer && (
          <Button variant="outline" onClick={() => setOpenDialog("transfer")}>
            Transfer
          </Button>
        )}
        {canAssign && (
          <Button variant="outline" onClick={() => setOpenDialog("return")}>
            Return
          </Button>
        )}
        {canRetire && (
          <Button variant="outline" onClick={() => setOpenDialog("retire")}>
            Retire
          </Button>
        )}
      </div>

      <AssignDialog
        assetId={assetId}
        open={openDialog === "assign"}
        onOpenChange={(open) => !open && setOpenDialog(null)}
        onDone={onDone}
      />
      <TransferDialog
        assetId={assetId}
        open={openDialog === "transfer"}
        onOpenChange={(open) => !open && setOpenDialog(null)}
        onDone={onDone}
      />
      <ReturnDialog
        assetId={assetId}
        open={openDialog === "return"}
        onOpenChange={(open) => !open && setOpenDialog(null)}
        onDone={onDone}
      />
      <RetireDialog
        assetId={assetId}
        open={openDialog === "retire"}
        onOpenChange={(open) => !open && setOpenDialog(null)}
        onDone={onDone}
      />
    </>
  )
}
