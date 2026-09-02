"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { useAssetCategoryOptions, type CustomFieldModule, type CustomFieldType } from "@/lib/use-lookup-options"

const NONE = "__none__"

export type CustomFieldDefinition = {
  _id: string
  module: CustomFieldModule
  // Only ever meaningful for module "assets" - which Asset Type (AssetCategory) this field is
  // scoped to. null/absent = applies to every asset in the org regardless of type.
  category?: string | null
  label: string
  key: string
  type: CustomFieldType
  options: string[]
  required: boolean
  order: number
  status: "Active" | "Inactive"
}

export type CustomFieldDefinitionFormValues = {
  _id?: string
  key?: string
  label: string
  type: CustomFieldType
  optionsText: string
  required: boolean
  order: string
  category: string
}

export const EMPTY_CUSTOM_FIELD_DEFINITION_FORM: CustomFieldDefinitionFormValues = {
  label: "",
  type: "text",
  optionsText: "",
  required: false,
  order: "0",
  category: "",
}

export function toCustomFieldDefinitionFormValues(definition: CustomFieldDefinition): CustomFieldDefinitionFormValues {
  return {
    _id: definition._id,
    key: definition.key,
    label: definition.label,
    type: definition.type,
    optionsText: definition.options.join(", "),
    required: definition.required,
    order: String(definition.order),
    category: definition.category ?? "",
  }
}

const TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  select: "Dropdown (select)",
  checkbox: "Checkbox",
}

const TYPES: CustomFieldType[] = ["text", "number", "date", "select", "checkbox"]

// Field-only, Dialog-agnostic - used directly by /custom-fields/add and /custom-fields/[id]/edit,
// mirroring asset-form.tsx/license-form.tsx's own shape. `module` is fixed context (which module
// this field belongs to), passed in separately rather than editable here - matches how the
// original dialog took it as its own prop, never part of the form state.
export function CustomFieldDefinitionForm({
  module,
  initial,
  onSaved,
  onCancel,
}: {
  module: CustomFieldModule
  initial: CustomFieldDefinitionFormValues
  onSaved: () => void
  onCancel?: () => void
}) {
  const [form, setForm] = React.useState<CustomFieldDefinitionFormValues>(initial)
  const [submitting, setSubmitting] = React.useState(false)
  const { items: categories } = useAssetCategoryOptions()

  const isEdit = Boolean(form._id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.label.trim()) {
      toast.error("Label is required")
      return
    }
    const options = form.optionsText
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean)
    if (form.type === "select" && options.length === 0) {
      toast.error("Add at least one option for a dropdown field")
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        label: form.label,
        type: form.type,
        options: form.type === "select" ? options : [],
        required: form.required,
        order: Number(form.order) || 0,
        ...(module === "assets" ? { category: form.category || null } : {}),
      }
      if (isEdit && form._id) {
        await apiClient.put(`/custom-field-definitions/${form._id}`, payload)
        toast.success("Custom field updated")
      } else {
        await apiClient.post("/custom-field-definitions", { ...payload, module })
        toast.success("Custom field created")
      }
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save custom field"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="cf-label">Label</Label>
        <Input id="cf-label" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
      </div>
      {isEdit && form.key && (
        <div className="flex flex-col gap-2">
          <Label>Key</Label>
          <p className="text-sm text-muted-foreground">{form.key}</p>
        </div>
      )}
      {module === "assets" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="cf-category">Asset Type</Label>
          <Select
            value={form.category || NONE}
            onValueChange={(v) => setForm((f) => ({ ...f, category: v === NONE ? "" : (v ?? "") }))}
          >
            <SelectTrigger id="cf-category" className="w-full">
              <SelectValue placeholder="All asset types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>All asset types</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c._id} value={c._id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Leave as &quot;All asset types&quot; for a field every asset shows, or pick one Asset
            Type so this field only appears on that type&apos;s assets.
          </p>
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="cf-type">Type</Label>
        <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: (v as CustomFieldType) ?? "text" }))}>
          <SelectTrigger id="cf-type" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {form.type === "select" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="cf-options">Options (comma-separated)</Label>
          <Input
            id="cf-options"
            value={form.optionsText}
            onChange={(e) => setForm((f) => ({ ...f, optionsText: e.target.value }))}
            placeholder="e.g. Small, Medium, Large"
          />
        </div>
      )}
      <div className="flex flex-col gap-2">
        <Label htmlFor="cf-order">Display order</Label>
        <Input id="cf-order" type="number" value={form.order} onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox checked={form.required} onCheckedChange={(checked) => setForm((f) => ({ ...f, required: checked === true }))} />
        Required
      </label>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : isEdit ? "Save changes" : "Create custom field"}
        </Button>
      </div>
    </form>
  )
}
