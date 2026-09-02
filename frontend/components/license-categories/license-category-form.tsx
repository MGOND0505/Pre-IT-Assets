"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient, apiErrorMessage } from "@/lib/api-client"

export type LicenseCategoryFormValues = { _id?: string; name: string; description: string }

export const EMPTY_LICENSE_CATEGORY_FORM: LicenseCategoryFormValues = { name: "", description: "" }

// Field-only, Dialog-agnostic - used directly by /licenses/categories/add and
// /licenses/categories/[id]/edit, mirroring asset-form.tsx/license-form.tsx's own shape.
export function LicenseCategoryForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: LicenseCategoryFormValues
  onSaved: () => void
  onCancel?: () => void
}) {
  const [form, setForm] = React.useState<LicenseCategoryFormValues>(initial)
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
        await apiClient.put(`/license-categories/${form._id}`, { name: form.name, description: form.description })
        toast.success("License category updated")
      } else {
        await apiClient.post("/license-categories", { name: form.name, description: form.description })
        toast.success("License category created")
      }
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save license category"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="lic-cat-name">Name</Label>
        <Input id="lic-cat-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="lic-cat-description">Description</Label>
        <Input
          id="lic-cat-description"
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
          {submitting ? "Saving..." : isEdit ? "Save changes" : "Create category"}
        </Button>
      </div>
    </form>
  )
}
