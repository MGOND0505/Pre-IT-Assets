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
import { ModulePermissionGrid, subAdminPermissions, emptyPermissions } from "@/components/users/permission-grid"
import { PasswordRequirementsHint } from "@/components/auth/password-requirements-hint"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { useDepartmentOptions, useLocationOptions } from "@/lib/use-lookup-options"
import { isPasswordValid, BASELINE_POLICY } from "@/lib/password-policy"

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

  const { items: departments } = useDepartmentOptions()
  const { items: locations } = useLocationOptions()

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
  }

  function handleRoleChange(next: RoleChoice) {
    setRole(next)
    // Re-seed a fresh Sub Admin preset each time it's (re-)selected, same as switching between
    // the helpdesk/task role presets elsewhere in this grid - a deliberate starting point, not
    // sticky state carried over from a previous selection.
    if (next === "subAdmin") setPermissions(subAdminPermissions())
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
        // Employee omits permissions entirely - the backend falls back to the org's configured
        // default employee template (settings.service.ts#getDefaultEmployeePermissions). Admin
        // sends an explicit empty matrix (isAdmin bypasses it regardless, but this avoids an
        // unnecessary settings lookup and a misleading stored value). Sub Admin sends its
        // editable preset.
        permissions: role === "admin" ? emptyPermissions() : role === "employee" ? undefined : permissions,
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
              <Label htmlFor="user-designation">Role / Designation</Label>
              <Input id="user-designation" value={designation} onChange={(e) => setDesignation(e.target.value)} />
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

          {role === "subAdmin" && (
            <div className="flex min-w-0 flex-col gap-2">
              <Label>Permissions</Label>
              <ModulePermissionGrid permissions={permissions} onPermissionsChange={setPermissions} />
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
