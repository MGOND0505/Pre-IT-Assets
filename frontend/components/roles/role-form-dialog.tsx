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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ModulePermissionGrid, emptyPermissions } from "@/components/users/permission-grid"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { type PermissionsShape } from "@/lib/permissions"

export type RolePortalType = "subAdmin" | "employee"

export type Role = {
  _id: string
  name: string
  description: string
  portalType: RolePortalType
  permissions: PermissionsShape
  status: "Active" | "Inactive"
}

// Mirrors user-form-dialog.tsx's own ROLE_DESCRIPTIONS wording for the same two tiers, so an
// admin sees consistent language whether they're picking a portal here or a role there.
const PORTAL_TYPE_DESCRIPTIONS: Record<RolePortalType, string> = {
  subAdmin: "Assignees get the standard admin-style dashboard/nav, scoped to whatever the permission grid below grants.",
  employee: "Assignees get the Employee Portal - a simplified view of only their own assets, tickets, and tasks.",
}

export function RoleFormDialog({
  role,
  onSaved,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  role?: Role
  onSaved: () => void
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isEdit = Boolean(role)
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange! : setInternalOpen

  const [name, setName] = React.useState(role?.name ?? "")
  const [description, setDescription] = React.useState(role?.description ?? "")
  const [portalType, setPortalType] = React.useState<RolePortalType>(role?.portalType ?? "subAdmin")
  const [permissions, setPermissions] = React.useState<PermissionsShape>(role?.permissions ?? emptyPermissions())
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setName(role?.name ?? "")
      setDescription(role?.description ?? "")
      setPortalType(role?.portalType ?? "subAdmin")
      setPermissions(role?.permissions ?? emptyPermissions())
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
        await apiClient.put(`/roles/${role._id}`, { name, description, portalType, permissions })
        toast.success("Role updated")
      } else {
        await apiClient.post("/roles", { name, description, portalType, permissions })
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && <DialogTrigger render={trigger ?? <Button>Add role</Button>} />}
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit role" : "Add role"}</DialogTitle>
          <DialogDescription>
            A reusable named permission template. Applying it to a user copies these permissions onto their account -
            editing this Role afterwards does not change users it was already applied to.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-name">Name</Label>
              <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="role-description">Description</Label>
              <Input id="role-description" value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="role-portal-type">Portal type</Label>
            <Select value={portalType} onValueChange={(v) => v && setPortalType(v as RolePortalType)}>
              <SelectTrigger id="role-portal-type" className="w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="subAdmin">Sub Admin</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{PORTAL_TYPE_DESCRIPTIONS[portalType]}</p>
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <Label>Permissions</Label>
            <ModulePermissionGrid permissions={permissions} onPermissionsChange={setPermissions} />
          </div>
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
