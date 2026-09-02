"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient, apiErrorMessage } from "@/lib/api-client"

export type DesignationFormValues = { _id?: string; name: string; description: string }

export const EMPTY_DESIGNATION_FORM: DesignationFormValues = { name: "", description: "" }

// Field-only, Dialog-agnostic - used directly by /designations/add and /designations/[id]/edit,
// mirroring asset-form.tsx/license-form.tsx/vendor-form.tsx's own shape.
export function DesignationForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: DesignationFormValues
  onSaved: () => void
  onCancel?: () => void
}) {
  const [form, setForm] = React.useState<DesignationFormValues>(initial)
  const [submitting, setSubmitting] = React.useState(false)

  const isEdit = Boolean(form._id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }

    setSubmitting(true)
    try {
      if (isEdit && form._id) {
        await apiClient.put(`/designations/${form._id}`, { name: form.name, description: form.description })
        toast.success("Designation updated")
      } else {
        await apiClient.post("/designations", { name: form.name, description: form.description })
        toast.success("Designation created")
      }
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save designation"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="desig-name">Name</Label>
        <Input id="desig-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="desig-description">Description</Label>
        <Input
          id="desig-description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : isEdit ? "Save changes" : "Create designation"}
        </Button>
      </div>
    </form>
  )
}
