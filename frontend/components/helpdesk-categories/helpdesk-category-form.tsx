"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { useUserOptions } from "@/lib/use-lookup-options"

const NONE = "__none__"

export type HelpdeskCategoryFormValues = { _id?: string; name: string; description: string; defaultAgent: string }

export const EMPTY_HELPDESK_CATEGORY_FORM: HelpdeskCategoryFormValues = { name: "", description: "", defaultAgent: "" }

// Field-only, Dialog-agnostic - used directly by /helpdesk/categories/add and
// /helpdesk/categories/[id]/edit, mirroring asset-form.tsx/license-form.tsx's own shape.
export function HelpdeskCategoryForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: HelpdeskCategoryFormValues
  onSaved: () => void
  onCancel?: () => void
}) {
  const [form, setForm] = React.useState<HelpdeskCategoryFormValues>(initial)
  const [submitting, setSubmitting] = React.useState(false)
  const { items: users } = useUserOptions()

  const isEdit = Boolean(form._id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }

    const payload = { name: form.name, description: form.description, defaultAgent: form.defaultAgent || null }

    setSubmitting(true)
    try {
      if (isEdit && form._id) {
        await apiClient.put(`/helpdesk-categories/${form._id}`, payload)
        toast.success("Category updated")
      } else {
        await apiClient.post("/helpdesk-categories", payload)
        toast.success("Category created")
      }
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save category"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="hdcat-name">Name</Label>
        <Input id="hdcat-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="hdcat-description">Description</Label>
        <Input
          id="hdcat-description"
          value={form.description}
          onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="hdcat-default-agent">Default agent</Label>
        <Select
          value={form.defaultAgent || NONE}
          onValueChange={(v) => setForm((f) => ({ ...f, defaultAgent: v === NONE ? "" : (v ?? "") }))}
        >
          <SelectTrigger id="hdcat-default-agent" className="w-full">
            <SelectValue placeholder="No default agent" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>None</SelectItem>
            {users.map((u) => (
              <SelectItem key={u._id} value={u._id}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          New tickets in this category auto-assign to this agent (or their backup, if on leave).
        </p>
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
