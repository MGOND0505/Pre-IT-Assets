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

export type AssetCategory = {
  _id: string
  name: string
  prefix: string
  description: string
  nextSequence: number
  status: "Active" | "Inactive"
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
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setName(category?.name ?? "")
      setPrefix(category?.prefix ?? "")
      setDescription(category?.description ?? "")
    }
  }, [open, category])

  async function handleSave() {
    if (!name.trim() || !prefix.trim()) {
      toast.error("Name and prefix are required")
      return
    }
    setSubmitting(true)
    try {
      if (isEdit && category) {
        await apiClient.put(`/asset-categories/${category._id}`, { name, prefix, description })
        toast.success("Asset category updated")
      } else {
        await apiClient.post("/asset-categories", { name, prefix, description })
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
