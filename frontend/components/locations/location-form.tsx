"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient, apiErrorMessage } from "@/lib/api-client"

export type LocationFormValues = {
  _id?: string
  name: string
  address: string
  city: string
  state: string
  country: string
}

export const EMPTY_LOCATION_FORM: LocationFormValues = { name: "", address: "", city: "", state: "", country: "" }

// Field-only, Dialog-agnostic - used directly by /locations/add and /locations/[id]/edit,
// mirroring asset-form.tsx/license-form.tsx/vendor-form.tsx's own shape.
export function LocationForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: LocationFormValues
  onSaved: () => void
  onCancel?: () => void
}) {
  const [form, setForm] = React.useState<LocationFormValues>(initial)
  const [submitting, setSubmitting] = React.useState(false)

  const isEdit = Boolean(form._id)

  function set(field: keyof Omit<LocationFormValues, "_id">) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }

    const payload = { name: form.name, address: form.address, city: form.city, state: form.state, country: form.country }

    setSubmitting(true)
    try {
      if (isEdit && form._id) {
        await apiClient.put(`/locations/${form._id}`, payload)
        toast.success("Location updated")
      } else {
        await apiClient.post("/locations", payload)
        toast.success("Location created")
      }
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save location"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : isEdit ? "Save changes" : "Create location"}
        </Button>
      </div>
    </form>
  )
}
