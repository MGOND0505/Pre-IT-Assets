"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { CustomFieldsSection } from "@/components/custom-fields/custom-fields-section"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { useCustomFieldDefinitionOptions } from "@/lib/use-lookup-options"

export type VendorFormValues = {
  _id?: string
  name: string
  contactPerson: string
  email: string
  phone: string
  service: string
  address: string
  contractStart: string
  contractEnd: string
  notes: string
  customFields: Record<string, unknown>
}

export const EMPTY_VENDOR_FORM: VendorFormValues = {
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  service: "",
  address: "",
  contractStart: "",
  contractEnd: "",
  notes: "",
  customFields: {},
}

function Field({
  label,
  id,
  value,
  onChange,
  type = "text",
}: {
  label: string
  id: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

// Field-only, Dialog-agnostic - used directly by /vendors/add and /vendors/[id]/edit (full pages,
// mirroring how asset-form.tsx/license-form.tsx are used directly by their own /add pages), never
// wrapped in a Dialog itself. There is no separate dialog-based vendor form anymore.
export function VendorForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: VendorFormValues
  onSaved: (vendorId: string) => void
  onCancel?: () => void
}) {
  const [form, setForm] = React.useState<VendorFormValues>(initial)
  const [submitting, setSubmitting] = React.useState(false)

  const { items: customFieldDefinitions } = useCustomFieldDefinitionOptions("vendors")
  const hasCustomFields = customFieldDefinitions.length > 0

  function set(field: keyof Omit<VendorFormValues, "_id" | "customFields">) {
    return (value: string) => setForm((f) => ({ ...f, [field]: value }))
  }

  const isEdit = Boolean(form._id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name.trim()) {
      toast.error("Vendor name is required")
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        ...form,
        contractStart: form.contractStart || undefined,
        contractEnd: form.contractEnd || undefined,
      }

      if (isEdit && form._id) {
        const res = await apiClient.put(`/vendors/${form._id}`, payload)
        toast.success("Vendor updated")
        onSaved(res.data.data._id)
      } else {
        const res = await apiClient.post("/vendors", payload)
        toast.success("Vendor created")
        onSaved(res.data.data._id)
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save vendor"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="col-span-2">
          <Field label="Vendor name" id="vendor-name" value={form.name} onChange={set("name")} />
        </div>
        <Field label="Contact person" id="vendor-contact" value={form.contactPerson} onChange={set("contactPerson")} />
        <Field label="Service" id="vendor-service" value={form.service} onChange={set("service")} />
        <Field label="Email" id="vendor-email" type="email" value={form.email} onChange={set("email")} />
        <Field label="Phone" id="vendor-phone" value={form.phone} onChange={set("phone")} />
        <div className="col-span-2">
          <Field label="Address" id="vendor-address" value={form.address} onChange={set("address")} />
        </div>
        <Field label="Contract start" id="vendor-contract-start" type="date" value={form.contractStart} onChange={set("contractStart")} />
        <Field label="Contract end" id="vendor-contract-end" type="date" value={form.contractEnd} onChange={set("contractEnd")} />
        <div className="col-span-2">
          <Field label="Notes" id="vendor-notes" value={form.notes} onChange={set("notes")} />
        </div>
      </div>

      {hasCustomFields && (
        <div className="flex flex-col gap-3 border-t pt-4">
          <p className="text-sm font-medium">Custom fields</p>
          <CustomFieldsSection
            module="vendors"
            value={form.customFields}
            onChange={(customFields) => setForm((f) => ({ ...f, customFields }))}
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : isEdit ? "Save changes" : "Create vendor"}
        </Button>
      </div>
    </form>
  )
}
