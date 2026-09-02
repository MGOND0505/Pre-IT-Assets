"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RoleForm, type RoleFormValues, type RolePortalType } from "@/components/roles/role-form"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can, type PermissionsShape } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

type Role = {
  _id: string
  name: string
  description: string
  portalType: RolePortalType
  permissions: PermissionsShape
  status: "Active" | "Inactive"
}

function toFormValues(role: Role): RoleFormValues {
  return {
    _id: role._id,
    name: role.name,
    description: role.description,
    portalType: role.portalType,
    permissions: role.permissions,
  }
}

export default function EditRolePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [role, setRole] = React.useState<Role | null>(null)
  const [loading, setLoading] = React.useState(true)

  const canWrite = can(user, "roles", "update")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Role>>(`/roles/${params.id}`)
      setRole(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load role"))
    } finally {
      setLoading(false)
    }
  }, [params.id])

  React.useEffect(() => {
    if (canWrite) load()
  }, [canWrite, load])

  if (authLoading || loading) return null
  if (!canWrite) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }
  if (!role) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Role</h1>
        <p className="text-sm text-muted-foreground">{role.name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Role details</CardTitle>
        </CardHeader>
        <CardContent>
          <RoleForm
            initial={toFormValues(role)}
            onSaved={() => router.push(toOrgHref("/roles"))}
            onCancel={() => router.push(toOrgHref("/roles"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
