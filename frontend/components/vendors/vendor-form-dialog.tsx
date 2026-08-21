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

export type Vendor = {
  _id: string
  name: string
  contactPerson: string
  email: string
  phone: string
  service: string
  address: string
  contractStart: string | null
  contractEnd: string | null
  status: "Active" | "Inactive"
  notes: string
}

function toDateInputValue(value: string | null | undefined) {
  return value ? value.slice(0, 10) : ""
}

export function VendorFormDialog({
  vendor,
  onSaved,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  vendor?: Vendor
  onSaved: () => void
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isEdit = Boolean(vendor)
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange! : setInternalOpen

  const emptyForm = {
    name: "",
    contactPerson: "",
    email: "",
    phone: "",
    service: "",
    address: "",
    contractStart: "",
    contractEnd: "",
    notes: "",
  }
  const [form, setForm] = React.useState(emptyForm)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setForm({
        name: vendor?.name ?? "",
        contactPerson: vendor?.contactPerson ?? "",
        email: vendor?.email ?? "",
        phone: vendor?.phone ?? "",
        service: vendor?.service ?? "",
        address: vendor?.address ?? "",
        contractStart: toDateInputValue(vendor?.contractStart),
        contractEnd: toDateInputValue(vendor?.contractEnd),
        notes: vendor?.notes ?? "",
      })
    }
  }, [open, vendor])

  function set(field: keyof typeof emptyForm) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        contractStart: form.contractStart || undefined,
        contractEnd: form.contractEnd || undefined,
      }
      if (isEdit && vendor) {
        await apiClient.put(`/vendors/${vendor._id}`, payload)
        toast.success("Vendor updated")
      } else {
        await apiClient.post("/vendors", payload)
        toast.success("Vendor created")
      }
      setOpen(false)
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save vendor"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && <DialogTrigger render={trigger ?? <Button>Add vendor</Button>} />}
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit vendor" : "Add vendor"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2 flex flex-col gap-2">
            <Label htmlFor="vendor-name">Vendor name</Label>
            <Input id="vendor-name" value={form.name} onChange={set("name")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="vendor-contact">Contact person</Label>
            <Input id="vendor-contact" value={form.contactPerson} onChange={set("contactPerson")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="vendor-service">Service</Label>
            <Input id="vendor-service" value={form.service} onChange={set("service")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="vendor-email">Email</Label>
            <Input id="vendor-email" type="email" value={form.email} onChange={set("email")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="vendor-phone">Phone</Label>
            <Input id="vendor-phone" value={form.phone} onChange={set("phone")} />
          </div>
          <div className="col-span-2 flex flex-col gap-2">
            <Label htmlFor="vendor-address">Address</Label>
            <Input id="vendor-address" value={form.address} onChange={set("address")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="vendor-contract-start">Contract start</Label>
            <Input id="vendor-contract-start" type="date" value={form.contractStart} onChange={set("contractStart")} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="vendor-contract-end">Contract end</Label>
            <Input id="vendor-contract-end" type="date" value={form.contractEnd} onChange={set("contractEnd")} />
          </div>
          <div className="col-span-2 flex flex-col gap-2">
            <Label htmlFor="vendor-notes">Notes</Label>
            <Input id="vendor-notes" value={form.notes} onChange={set("notes")} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : isEdit ? "Save changes" : "Create vendor"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
