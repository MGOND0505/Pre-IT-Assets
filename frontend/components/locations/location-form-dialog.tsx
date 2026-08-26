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

export type Location = {
  _id: string
  name: string
  address: string
  city: string
  state: string
  country: string
  status: "Active" | "Inactive"
}

export function LocationFormDialog({
  location,
  onSaved,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  location?: Location
  onSaved: () => void
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isEdit = Boolean(location)
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange! : setInternalOpen

  const [form, setForm] = React.useState({ name: "", address: "", city: "", state: "", country: "" })
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setForm({
        name: location?.name ?? "",
        address: location?.address ?? "",
        city: location?.city ?? "",
        state: location?.state ?? "",
        country: location?.country ?? "",
      })
    }
  }, [open, location])

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }
    setSubmitting(true)
    try {
      if (isEdit && location) {
        await apiClient.put(`/locations/${location._id}`, form)
        toast.success("Location updated")
      } else {
        await apiClient.post("/locations", form)
        toast.success("Location created")
      }
      setOpen(false)
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save location"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && <DialogTrigger render={trigger ?? <Button>Add location</Button>} />}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit location" : "Add location"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="loc-name">Name</Label>
            <Input id="loc-name" value={form.name} onChange={set("name")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="loc-address">Address</Label>
            <Input id="loc-address" value={form.address} onChange={set("address")} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="loc-city">City</Label>
              <Input id="loc-city" value={form.city} onChange={set("city")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="loc-state">State</Label>
              <Input id="loc-state" value={form.state} onChange={set("state")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="loc-country">Country</Label>
              <Input id="loc-country" value={form.country} onChange={set("country")} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : isEdit ? "Save changes" : "Create location"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
