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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { useUserOptions } from "@/lib/use-lookup-options"

const NONE = "__none__"

export type HelpdeskCategory = {
  _id: string
  name: string
  description: string
  defaultAgent: { _id: string; name: string } | null
  status: "Active" | "Inactive"
}

export function HelpdeskCategoryFormDialog({
  category,
  onSaved,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  category?: HelpdeskCategory
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
  const [description, setDescription] = React.useState("")
  const [defaultAgent, setDefaultAgent] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)
  const { items: users } = useUserOptions()

  React.useEffect(() => {
    if (open) {
      setName(category?.name ?? "")
      setDescription(category?.description ?? "")
      setDefaultAgent(category?.defaultAgent?._id ?? "")
    }
  }, [open, category])

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    setSubmitting(true)
    try {
      const payload = { name, description, defaultAgent: defaultAgent || null }
      if (isEdit && category) {
        await apiClient.put(`/helpdesk-categories/${category._id}`, payload)
        toast.success("Category updated")
      } else {
        await apiClient.post("/helpdesk-categories", payload)
        toast.success("Category created")
      }
      setOpen(false)
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save category"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && <DialogTrigger render={trigger ?? <Button>Add category</Button>} />}
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit category" : "Add category"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="hdcat-name">Name</Label>
            <Input id="hdcat-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="hdcat-description">Description</Label>
            <Input id="hdcat-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="hdcat-default-agent">Default agent</Label>
            <Select value={defaultAgent || NONE} onValueChange={(v) => setDefaultAgent(v === NONE ? "" : (v ?? ""))}>
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
