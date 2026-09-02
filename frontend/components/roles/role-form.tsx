"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ModulePermissionGrid, emptyPermissions } from "@/components/users/permission-grid"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { type PermissionsShape } from "@/lib/permissions"

export type RolePortalType = "subAdmin" | "employee"

export type RoleFormValues = {
  _id?: string
  name: string
  description: string
  portalType: RolePortalType
  permissions: PermissionsShape
}

export const EMPTY_ROLE_FORM: RoleFormValues = {
  name: "",
  description: "",
  portalType: "subAdmin",
  permissions: emptyPermissions(),
}

// Mirrors user-form.tsx's own ROLE_DESCRIPTIONS wording for the same two tiers, so an admin sees
// consistent language whether they're picking a portal here or a role there.
const PORTAL_TYPE_DESCRIPTIONS: Record<RolePortalType, string> = {
  subAdmin: "Assignees get the standard admin-style dashboard/nav, scoped to whatever the permission grid below grants.",
  employee: "Assignees get the Employee Portal - a simplified view of only their own assets, tickets, and tasks.",
}

// Field-only, Dialog-agnostic - used directly by /roles/add and /roles/[id]/edit, mirroring
// asset-form.tsx/license-form.tsx/vendor-form.tsx's own shape.
export function RoleForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: RoleFormValues
  onSaved: () => void
  onCancel?: () => void
}) {
  const [form, setForm] = React.useState<RoleFormValues>(initial)
  const [submitting, setSubmitting] = React.useState(false)

  const isEdit = Boolean(form._id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }

    const payload = {
      name: form.name,
      description: form.description,
      portalType: form.portalType,
      permissions: form.permissions,
    }

    setSubmitting(true)
    try {
      if (isEdit && form._id) {
        await apiClient.put(`/roles/${form._id}`, payload)
        toast.success("Role updated")
      } else {
        await apiClient.post("/roles", payload)
        toast.success("Role created")
      }
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save role"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-4">
      <p className="text-sm text-muted-foreground">
        A reusable named permission template. Applying it to a user copies these permissions onto their account -
        editing this Role afterwards does not change users it was already applied to.
      </p>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="role-name">Name</Label>
          <Input id="role-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="role-description">Description</Label>
          <Input
            id="role-description"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="role-portal-type">Portal type</Label>
        <Select
          value={form.portalType}
          onValueChange={(v) => v && setForm((f) => ({ ...f, portalType: v as RolePortalType }))}
        >
          <SelectTrigger id="role-portal-type" className="w-full sm:w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="subAdmin">Sub Admin</SelectItem>
            <SelectItem value="employee">Employee</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">{PORTAL_TYPE_DESCRIPTIONS[form.portalType]}</p>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <Label>Permissions</Label>
        <ModulePermissionGrid
          permissions={form.permissions}
          onPermissionsChange={(permissions) => setForm((f) => ({ ...f, permissions }))}
        />
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : isEdit ? "Save changes" : "Create role"}
        </Button>
      </div>
    </form>
  )
}
