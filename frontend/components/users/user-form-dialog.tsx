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
import { ModulePermissionGrid, subAdminPermissions, basicUserPermissions, emptyPermissions } from "@/components/users/permission-grid"
import { PasswordRequirementsHint } from "@/components/auth/password-requirements-hint"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { useDepartmentOptions, useDesignationOptions, useLocationOptions, useRoleOptions } from "@/lib/use-lookup-options"
import { isPasswordValid, BASELINE_POLICY } from "@/lib/password-policy"
import type { PermissionsShape } from "@/lib/permissions"

const NO_ROLE = "__custom__"

const NONE = "__none__"

type RoleChoice = "admin" | "subAdmin" | "employee"

const ROLE_DESCRIPTIONS: Record<RoleChoice, string> = {
  admin: "Full access to every module and action.",
  subAdmin: "Broad operational access (assets, licenses, vendors, tickets, tasks, reports) without user or org-settings management. Editable below.",
  employee: "Sees only their own assigned assets, tickets, and tasks in the Employee Portal. Gets the organization's configured default permissions (Administration > Settings > Employee Default Permissions).",
}

export function UserFormDialog({ onCreated }: { onCreated: () => void }) {
  const { user: currentUser } = useAuth()
  const policy = currentUser?.passwordPolicy ?? BASELINE_POLICY
  const [open, setOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [employeeId, setEmployeeId] = React.useState("")
  const [designation, setDesignation] = React.useState("")
  const [department, setDepartment] = React.useState("")
  const [location, setLocation] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [role, setRole] = React.useState<RoleChoice>("employee")
  const [permissions, setPermissions] = React.useState(subAdminPermissions())
  // Id of the saved Role template currently applied, or NO_ROLE - "Custom" (edit manually).
  // Sent to the backend (as `roleId`) if and only if it's still a real id - see
  // handlePermissionsChange/handleRoleTemplateChange, which clear it back to NO_ROLE the moment
  // the admin's last action stops being "picked a saved Role from the dropdown".
  const [roleTemplateId, setRoleTemplateId] = React.useState(NO_ROLE)

  const { items: departments } = useDepartmentOptions()
  const { items: designations } = useDesignationOptions()
  const { items: locations } = useLocationOptions()
  const { items: roleOptions } = useRoleOptions(role === "admin" ? undefined : role)

  // For Employee specifically, showing an editable grid only once a saved Role has actually been
  // applied preserves today's default behavior otherwise: no customization at all still means
  // "omit permissions, fall back to the org's configured Employee Default Permissions template"
  // (see the submit payload below) rather than silently sending a hardcoded seed nobody asked for.
  // Sub Admin keeps its existing always-visible grid.
  const showPermissionGrid = role === "subAdmin" || (role === "employee" && roleTemplateId !== NO_ROLE)

  function reset() {
    setName("")
    setEmail("")
    setEmployeeId("")
    setDesignation("")
    setDepartment("")
    setLocation("")
    setPassword("")
    setRole("employee")
    setPermissions(subAdminPermissions())
    setRoleTemplateId(NO_ROLE)
  }

  function handleRoleChange(next: RoleChoice) {
    setRole(next)
    setRoleTemplateId(NO_ROLE)
    // Re-seed a fresh tier preset each time it's (re-)selected, same as switching between the
    // helpdesk/task role presets elsewhere in this grid - a deliberate starting point, not sticky
    // state carried over from a previous selection or a stale saved-Role pick from another tier.
    if (next === "subAdmin") setPermissions(subAdminPermissions())
    if (next === "employee") setPermissions(basicUserPermissions())
  }

  function handlePermissionsChange(next: PermissionsShape) {
    setPermissions(next)
    // A manual checkbox edit means the grid no longer matches whatever saved Role seeded it -
    // stop treating this as "apply Role X" and fall back to sending the edited matrix directly.
    setRoleTemplateId(NO_ROLE)
  }

  function handleRoleTemplateChange(value: string) {
    setRoleTemplateId(value)
    if (value === NO_ROLE) return
    const selected = roleOptions.find((r) => r._id === value)
    if (selected) setPermissions(selected.permissions)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required")
      return
    }
    if (!isPasswordValid(password, policy)) {
      toast.error("Password does not meet the requirements")
      return
    }

    setSubmitting(true)
    try {
      await apiClient.post("/users", {
        name,
        email,
        employeeId: employeeId || undefined,
        designation: designation || undefined,
        department: department || undefined,
        location: location || undefined,
        password,
        isAdmin: role === "admin",
        employeeTier: role === "admin" ? undefined : role,
        // Employee with no saved Role applied omits permissions entirely - the backend falls back
        // to the org's configured default employee template
        // (settings.service.ts#getDefaultEmployeePermissions). Admin sends an explicit empty
        // matrix (isAdmin bypasses it regardless, but this avoids an unnecessary settings lookup
        // and a misleading stored value). Sub Admin, and Employee once a Role has been applied,
        // send the (possibly since hand-edited) grid.
        permissions:
          role === "admin" ? emptyPermissions() : role === "employee" && roleTemplateId === NO_ROLE ? undefined : permissions,
        // Sent if and only if the admin's last action was picking a saved Role from the dropdown
        // below - any manual checkbox edit or switch back to "Custom" clears this first.
        roleId: roleTemplateId === NO_ROLE ? undefined : roleTemplateId,
      })
      toast.success("User created")
      reset()
      setOpen(false)
      onCreated()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not create user"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Add user</Button>} />
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>Add user</DialogTitle>
          <DialogDescription>
            They&apos;ll be required to change this password the first time they log in.
          </DialogDescription>
        </DialogHeader>
        <form className="flex min-w-0 flex-col gap-4" onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-name">Name</Label>
              <Input id="user-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-email">Email</Label>
              <Input id="user-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-employee-id">Employee ID</Label>
              <Input id="user-employee-id" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-designation">Designation</Label>
              <Select value={designation || NONE} onValueChange={(v) => setDesignation(v === NONE ? "" : (v ?? ""))}>
                <SelectTrigger id="user-designation" className="w-full">
                  <SelectValue placeholder="Select a designation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {designations.map((d) => (
                    <SelectItem key={d._id} value={d._id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-department">Department</Label>
              <Select value={department || NONE} onValueChange={(v) => setDepartment(v === NONE ? "" : (v ?? ""))}>
                <SelectTrigger id="user-department" className="w-full">
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d._id} value={d._id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-location">Location</Label>
              <Select value={location || NONE} onValueChange={(v) => setLocation(v === NONE ? "" : (v ?? ""))}>
                <SelectTrigger id="user-location" className="w-full">
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {locations.map((l) => (
                    <SelectItem key={l._id} value={l._id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="user-password">Temporary password</Label>
            <Input id="user-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <PasswordRequirementsHint password={password} policy={policy} />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="user-role">Role</Label>
            <Select value={role} onValueChange={(v) => handleRoleChange(v as RoleChoice)}>
              <SelectTrigger id="user-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="subAdmin">Sub Admin</SelectItem>
                <SelectItem value="employee">Employee</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTIONS[role]}</p>
          </div>

          {role !== "admin" && (
            <div className="flex flex-col gap-2">
              <Label htmlFor="user-role-template">Apply a saved role (optional)</Label>
              <Select value={roleTemplateId} onValueChange={(v) => v && handleRoleTemplateChange(v)}>
                <SelectTrigger id="user-role-template" className="w-full sm:w-72">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ROLE}>Custom (edit manually below)</SelectItem>
                  {roleOptions.map((r) => (
                    <SelectItem key={r._id} value={r._id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {showPermissionGrid && (
            <div className="flex min-w-0 flex-col gap-2">
              <Label>Permissions</Label>
              <ModulePermissionGrid permissions={permissions} onPermissionsChange={handlePermissionsChange} />
            </div>
          )}

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creating..." : "Create user"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
