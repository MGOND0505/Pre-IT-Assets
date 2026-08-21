"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PermissionMatrix } from "@/components/roles/permission-matrix"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import type { RoleOption } from "@/lib/use-roles"

type RoleFormDialogProps = {
  role?: RoleOption
  onSaved: () => void
  trigger?: React.ReactElement
  /** Pass to control the dialog from outside (e.g. a dropdown menu item) instead of its own trigger button. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}

export function RoleFormDialog({ role, onSaved, trigger, open: controlledOpen, onOpenChange }: RoleFormDialogProps) {
  const isEdit = Boolean(role)
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange! : setInternalOpen

  const [name, setName] = React.useState(role?.name ?? "")
  const [description, setDescription] = React.useState(role?.description ?? "")
  const [permissionKeys, setPermissionKeys] = React.useState<string[]>(role?.permissions.map((p) => p.key) ?? [])
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setName(role?.name ?? "")
      setDescription(role?.description ?? "")
      setPermissionKeys(role?.permissions.map((p) => p.key) ?? [])
    }
  }, [open, role])

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }

    setSubmitting(true)
    try {
      if (isEdit && role) {
        await apiClient.put(`/roles/${role._id}`, { name, description, permissionKeys })
        toast.success("Role updated")
      } else {
        await apiClient.post("/roles", { name, description, permissionKeys })
        toast.success("Role created")
      }
      setOpen(false)
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save role"))
    } finally {
      setSubmitting(false)
    }
  }

  const matrixDisabled = role?.isSuperAdmin ?? false

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && <DialogTrigger render={trigger ?? <Button>Add role</Button>} />}
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? `Edit ${role?.name}` : "Add role"}</DialogTitle>
          <DialogDescription>
            {matrixDisabled
              ? "Super Admin always has full access - its permissions can't be restricted."
              : "Pick exactly which actions this role is allowed to perform, per module."}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-name">Name</Label>
              <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} disabled={role?.isSystem} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-description">Description</Label>
              <Input id="role-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <PermissionMatrix value={permissionKeys} onChange={setPermissionKeys} disabled={matrixDisabled} />
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : isEdit ? "Save changes" : "Create role"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
