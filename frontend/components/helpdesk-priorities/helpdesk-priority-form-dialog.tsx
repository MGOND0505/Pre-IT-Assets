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

export type HelpdeskPriority = {
  _id: string
  name: string
  order: number
  color: string
  slaResponseMinutes: number
  slaResolutionMinutes: number
  status: "Active" | "Inactive"
}

export function HelpdeskPriorityFormDialog({
  priority,
  onSaved,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  priority?: HelpdeskPriority
  onSaved: () => void
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isEdit = Boolean(priority)
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange! : setInternalOpen

  const [name, setName] = React.useState("")
  const [order, setOrder] = React.useState("0")
  const [color, setColor] = React.useState("#0080F0")
  const [slaResponseMinutes, setSlaResponseMinutes] = React.useState("60")
  const [slaResolutionMinutes, setSlaResolutionMinutes] = React.useState("480")
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setName(priority?.name ?? "")
      setOrder(String(priority?.order ?? 0))
      setColor(priority?.color ?? "#0080F0")
      setSlaResponseMinutes(String(priority?.slaResponseMinutes ?? 60))
      setSlaResolutionMinutes(String(priority?.slaResolutionMinutes ?? 480))
    }
  }, [open, priority])

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        name,
        order: Number(order),
        color,
        slaResponseMinutes: Number(slaResponseMinutes),
        slaResolutionMinutes: Number(slaResolutionMinutes),
      }
      if (isEdit && priority) {
        await apiClient.put(`/helpdesk-priorities/${priority._id}`, payload)
        toast.success("Priority updated")
      } else {
        await apiClient.post("/helpdesk-priorities", payload)
        toast.success("Priority created")
      }
      setOpen(false)
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save priority"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && <DialogTrigger render={trigger ?? <Button>Add priority</Button>} />}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit priority" : "Add priority"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="hdpri-name">Name</Label>
            <Input id="hdpri-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Critical" />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="hdpri-order">Sort order</Label>
              <Input id="hdpri-order" type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="hdpri-color">Color</Label>
              <Input id="hdpri-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-8 p-1" />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="hdpri-response">SLA response (minutes)</Label>
              <Input
                id="hdpri-response"
                type="number"
                min={1}
                value={slaResponseMinutes}
                onChange={(e) => setSlaResponseMinutes(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="hdpri-resolution">SLA resolution (minutes)</Label>
              <Input
                id="hdpri-resolution"
                type="number"
                min={1}
                value={slaResolutionMinutes}
                onChange={(e) => setSlaResolutionMinutes(e.target.value)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : isEdit ? "Save changes" : "Create priority"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
