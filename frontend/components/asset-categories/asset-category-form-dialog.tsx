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

export const ASSET_CATEGORY_GROUPS = [
  "End-User Computing",
  "Mobile Devices",
  "Display & AV",
  "IT Infrastructure",
  "Peripherals & Other",
] as const

// The Hardware/Security field set a category's `visibleCoreFields` can toggle - matches
// backend/src/models/Asset.ts's own Hardware+Security field keys. Identification/Assignment/
// Location/Procurement/Warranty fields are never in this list - those stay universal, per the
// category-based Assets redesign's "Common Asset Fields" requirement.
export const ASSET_CORE_FIELD_OPTIONS: { key: string; label: string }[] = [
  { key: "CPU", label: "CPU" },
  { key: "ram", label: "RAM" },
  { key: "storage", label: "Storage" },
  { key: "display", label: "Display" },
  { key: "hostname", label: "Hostname" },
  { key: "macAddress", label: "MAC address" },
  { key: "adapterSerialNumber", label: "Adapter serial number" },
  { key: "operatingSystem", label: "Operating system" },
  { key: "osVersion", label: "OS version" },
  { key: "remarks", label: "Remarks" },
  { key: "domainName", label: "Domain name" },
  { key: "antivirusStatus", label: "Antivirus status" },
]

export type AssetCategory = {
  _id: string
  name: string
  prefix: string
  description: string
  nextSequence: number
  status: "Active" | "Inactive"
  group: (typeof ASSET_CATEGORY_GROUPS)[number]
  visibleCoreFields: string[] | null
}

export function AssetCategoryFormDialog({
  category,
  onSaved,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  category?: AssetCategory
  onSaved: () => void
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isEdit = Boolean(category)
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange! : setInternalOpen

  const [name, setName] = React.useState("")
  const [prefix, setPrefix] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [group, setGroup] = React.useState<(typeof ASSET_CATEGORY_GROUPS)[number]>("Peripherals & Other")
  // Whether this category has a curated technical-field list at all - unchecked means
  // `visibleCoreFields: null` ("show every field"), the backward-compatible default. Checked with
  // zero fields selected is a deliberate, valid choice (e.g. a TV needs none of them).
  const [curateFields, setCurateFields] = React.useState(false)
  const [visibleCoreFields, setVisibleCoreFields] = React.useState<string[]>([])
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setName(category?.name ?? "")
      setPrefix(category?.prefix ?? "")
      setDescription(category?.description ?? "")
      setGroup(category?.group ?? "Peripherals & Other")
      setCurateFields(category?.visibleCoreFields != null)
      setVisibleCoreFields(category?.visibleCoreFields ?? [])
    }
  }, [open, category])

  function toggleField(key: string) {
    setVisibleCoreFields((fields) => (fields.includes(key) ? fields.filter((f) => f !== key) : [...fields, key]))
  }

  async function handleSave() {
    if (!name.trim() || !prefix.trim()) {
      toast.error("Name and prefix are required")
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        name,
        prefix,
        description,
        group,
        visibleCoreFields: curateFields ? visibleCoreFields : null,
      }
      if (isEdit && category) {
        await apiClient.put(`/asset-categories/${category._id}`, payload)
        toast.success("Asset category updated")
      } else {
        await apiClient.post("/asset-categories", payload)
        toast.success("Asset category created")
      }
      setOpen(false)
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save asset category"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && <DialogTrigger render={trigger ?? <Button>Add category</Button>} />}
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit asset category" : "Add asset category"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="cat-name">Name</Label>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cat-prefix">Asset ID prefix</Label>
            <Input
              id="cat-prefix"
              value={prefix}
              onChange={(e) => setPrefix(e.target.value.toUpperCase())}
              placeholder="e.g. LAP"
              maxLength={6}
            />
            <p className="text-xs text-muted-foreground">
              Used to generate IDs like VNR-{prefix || "XXX"}-000001.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cat-description">Description</Label>
            <Input id="cat-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="cat-group">Group</Label>
            <Select value={group} onValueChange={(v) => setGroup(v as (typeof ASSET_CATEGORY_GROUPS)[number])}>
              <SelectTrigger id="cat-group" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ASSET_CATEGORY_GROUPS.map((g) => (
                  <SelectItem key={g} value={g}>
                    {g}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Where this asset type appears in the Assets module&apos;s category navigation.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Checkbox id="cat-curate-fields" checked={curateFields} onCheckedChange={(v) => setCurateFields(v === true)} />
              <Label htmlFor="cat-curate-fields">Limit which technical fields this type shows</Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Unchecked (default): the create/edit form and detail view show every Hardware/Security
              field for this type. Checked: only the fields selected below are shown - useful for a
              type like TV or Switch that doesn&apos;t need CPU/RAM.
            </p>
            {curateFields && (
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-3">
                {ASSET_CORE_FIELD_OPTIONS.map((f) => (
                  <div key={f.key} className="flex items-center gap-2">
                    <Checkbox
                      id={`cat-field-${f.key}`}
                      checked={visibleCoreFields.includes(f.key)}
                      onCheckedChange={() => toggleField(f.key)}
                    />
                    <Label htmlFor={`cat-field-${f.key}`} className="text-sm font-normal">
                      {f.label}
                    </Label>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : isEdit ? "Save changes" : "Create category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
