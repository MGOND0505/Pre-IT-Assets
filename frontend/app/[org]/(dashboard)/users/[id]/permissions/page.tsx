"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ModulePermissionGrid, basicUserPermissions, subAdminPermissions } from "@/components/users/permission-grid"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { emptyPermissions, type PermissionsShape } from "@/lib/permissions"
import { useRoleOptions } from "@/lib/use-lookup-options"
import { useOrgHref } from "@/lib/use-org-href"

type RoleChoice = "admin" | "subAdmin" | "employee"
type EmployeeTier = "subAdmin" | "employee" | null

const NO_ROLE = "__custom__"

type UserRecord = {
  _id: string
  email: string
  isAdmin: boolean
  employeeTier: EmployeeTier
  permissions: PermissionsShape
  roleTemplate?: { _id: string; name: string } | null
}

function roleOf(isAdmin: boolean, employeeTier: EmployeeTier): RoleChoice {
  if (isAdmin) return "admin"
  // null covers every pre-existing account created before this field existed - treated
  // identically to "subAdmin" everywhere else in the app, so default the picker there too.
  return employeeTier === "employee" ? "employee" : "subAdmin"
}

export default function EditUserPermissionsPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user: currentUser, loading: authLoading } = useAuth()
  const [record, setRecord] = React.useState<UserRecord | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)

  const [role, setRole] = React.useState<RoleChoice>("subAdmin")
  const [permissions, setPermissions] = React.useState<PermissionsShape>(emptyPermissions())
  const [roleTemplateId, setRoleTemplateId] = React.useState(NO_ROLE)

  const canManagePrivileged = Boolean(currentUser?.isAdmin)
  const { items: roleOptions } = useRoleOptions(role === "admin" ? undefined : role)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<UserRecord>>(`/users/${params.id}`)
      const user = res.data.data
      setRecord(user)
      setRole(roleOf(user.isAdmin, user.employeeTier))
      setPermissions(user.permissions ?? emptyPermissions())
      setRoleTemplateId(user.roleTemplate?._id ?? NO_ROLE)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load user"))
    } finally {
      setLoading(false)
    }
  }, [params.id])

  React.useEffect(() => {
    if (canManagePrivileged) load()
  }, [canManagePrivileged, load])

  function handleRoleChange(next: RoleChoice) {
    const previousTier = record ? roleOf(record.isAdmin, record.employeeTier) : "subAdmin"
    setRole(next)
    setRoleTemplateId(NO_ROLE)
    // Only re-seed a fresh preset when actually SWITCHING into a tier - if it already matches
    // where the account started, keep their real current permissions instead of clobbering them.
    if (next !== previousTier) {
      if (next === "subAdmin") setPermissions(subAdminPermissions())
      if (next === "employee") setPermissions(basicUserPermissions())
    }
  }

  function handlePermissionsChange(next: PermissionsShape) {
    setPermissions(next)
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
    if (!record) return

    setSubmitting(true)
    try {
      await apiClient.put(`/users/${record._id}/permissions`, {
        isAdmin: role === "admin",
        employeeTier: role === "admin" ? null : role,
        permissions: role === "admin" ? emptyPermissions() : permissions,
        roleId: roleTemplateId === NO_ROLE ? null : roleTemplateId,
      })
      toast.success(`Permissions updated for ${record.email}`)
      router.push(toOrgHref("/users"))
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update permissions"))
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loading) return null
  if (!canManagePrivileged) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }
  if (!record) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Permissions</h1>
        <p className="text-sm text-muted-foreground">{record.email}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Role &amp; permissions</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="edit-perm-role">Role</Label>
              <Select value={role} onValueChange={(v) => handleRoleChange(v as RoleChoice)}>
                <SelectTrigger id="edit-perm-role" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="subAdmin">Sub Admin</SelectItem>
                  <SelectItem value="employee">Employee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {role !== "admin" && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-perm-role-template">Apply a saved role (optional)</Label>
                <Select value={roleTemplateId} onValueChange={(v) => v && handleRoleTemplateChange(v)}>
                  <SelectTrigger id="edit-perm-role-template" className="w-full sm:w-72">
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
            {role !== "admin" && <ModulePermissionGrid permissions={permissions} onPermissionsChange={handlePermissionsChange} />}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => router.push(toOrgHref("/users"))}>
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving..." : "Save permissions"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
