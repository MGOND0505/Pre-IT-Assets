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
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient, apiErrorMessage } from "@/lib/api-client"

export type Designation = { _id: string; name: string; description: string; status: "Active" | "Inactive" }

export function DesignationFormDialog({
  designation,
  onSaved,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  designation?: Designation
  onSaved: () => void
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isEdit = Boolean(designation)
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange! : setInternalOpen

  const [name, setName] = React.useState(designation?.name ?? "")
  const [description, setDescription] = React.useState(designation?.description ?? "")
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setName(designation?.name ?? "")
      setDescription(designation?.description ?? "")
    }
  }, [open, designation])

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    setSubmitting(true)
    try {
      if (isEdit && designation) {
        await apiClient.put(`/designations/${designation._id}`, { name, description })
        toast.success("Designation updated")
      } else {
        await apiClient.post("/designations", { name, description })
        toast.success("Designation created")
      }
      setOpen(false)
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save designation"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && <DialogTrigger render={trigger ?? <Button>Add designation</Button>} />}
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit designation" : "Add designation"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="desig-name">Name</Label>
            <Input id="desig-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="desig-description">Description</Label>
            <Input id="desig-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : isEdit ? "Save changes" : "Create designation"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
