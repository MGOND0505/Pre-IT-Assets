"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

const TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  select: "Dropdown (select)",
  checkbox: "Checkbox",
}

const TYPES: CustomFieldType[] = ["text", "number", "date", "select", "checkbox"]

export function CustomFieldDefinitionFormDialog({
  module,
  definition,
  onSaved,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  module: CustomFieldModule
  definition?: CustomFieldDefinition
  onSaved: () => void
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isEdit = Boolean(definition)
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange! : setInternalOpen

  const { items: categories } = useAssetCategoryOptions()

  const [label, setLabel] = React.useState(definition?.label ?? "")
  const [type, setType] = React.useState<CustomFieldType>(definition?.type ?? "text")
  const [optionsText, setOptionsText] = React.useState((definition?.options ?? []).join(", "))
  const [required, setRequired] = React.useState(definition?.required ?? false)
  const [order, setOrder] = React.useState(String(definition?.order ?? 0))
  const [category, setCategory] = React.useState(definition?.category ?? "")
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setLabel(definition?.label ?? "")
      setType(definition?.type ?? "text")
      setOptionsText((definition?.options ?? []).join(", "))
      setRequired(definition?.required ?? false)
      setOrder(String(definition?.order ?? 0))
      setCategory(definition?.category ?? "")
    }
  }, [open, definition])

  async function handleSave() {
    if (!label.trim()) {
      toast.error("Label is required")
      return
    }
    const options = optionsText
      .split(",")
      .map((o) => o.trim())
      .filter(Boolean)
    if (type === "select" && options.length === 0) {
      toast.error("Add at least one option for a dropdown field")
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        label,
        type,
        options: type === "select" ? options : [],
        required,
        order: Number(order) || 0,
        ...(module === "assets" ? { category: category || null } : {}),
      }
      if (isEdit && definition) {
        await apiClient.put(`/custom-field-definitions/${definition._id}`, payload)
        toast.success("Custom field updated")
      } else {
        await apiClient.post("/custom-field-definitions", { ...payload, module })
        toast.success("Custom field created")
      }
      setOpen(false)
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save custom field"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && <DialogTrigger render={trigger ?? <Button>Add custom field</Button>} />}
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit custom field" : "Add custom field"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cf-label">Label</Label>
            <Input id="cf-label" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          {isEdit && definition && (
            <div className="flex flex-col gap-2">
              <Label>Key</Label>
              <p className="text-sm text-muted-foreground">{definition.key}</p>
            </div>
          )}
          {module === "assets" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="cf-category">Asset Type</Label>
              <Select value={category || NONE} onValueChange={(v) => setCategory(v === NONE ? "" : (v ?? ""))}>
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
            <Select value={type} onValueChange={(v) => setType((v as CustomFieldType) ?? "text")}>
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
          {type === "select" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="cf-options">Options (comma-separated)</Label>
              <Input
                id="cf-options"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
                placeholder="e.g. Small, Medium, Large"
              />
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Label htmlFor="cf-order">Display order</Label>
            <Input id="cf-order" type="number" value={order} onChange={(e) => setOrder(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={required} onCheckedChange={(checked) => setRequired(checked === true)} />
            Required
          </label>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : isEdit ? "Save changes" : "Create custom field"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
