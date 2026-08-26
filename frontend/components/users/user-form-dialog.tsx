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
import { PermissionGrid } from "@/components/users/permission-grid"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { emptyPermissions } from "@/lib/permissions"
import { useDepartmentOptions, useLocationOptions } from "@/lib/use-lookup-options"

const NONE = "__none__"

export function UserFormDialog({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [employeeId, setEmployeeId] = React.useState("")
  const [designation, setDesignation] = React.useState("")
  const [department, setDepartment] = React.useState("")
  const [location, setLocation] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [isAdmin, setIsAdmin] = React.useState(false)
  const [permissions, setPermissions] = React.useState(emptyPermissions())

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
    setIsAdmin(false)
    setPermissions(emptyPermissions())
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required")
      return
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters")
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
        isAdmin,
        permissions,
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
      <DialogContent className="max-w-xl">
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
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <Label>Permissions</Label>
            <PermissionGrid
              isAdmin={isAdmin}
              onIsAdminChange={setIsAdmin}
              permissions={permissions}
              onPermissionsChange={setPermissions}
            />
          </div>

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
