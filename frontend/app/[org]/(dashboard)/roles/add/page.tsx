"use client"

import { useRouter } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RoleForm, EMPTY_ROLE_FORM } from "@/components/roles/role-form"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

export default function AddRolePage() {
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()

  const canCreate = can(user, "roles", "create")

  if (authLoading) return null
  if (!canCreate) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Role</h1>
        <p className="text-sm text-muted-foreground">Create a reusable named permission template.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New role</CardTitle>
        </CardHeader>
        <CardContent>
          <RoleForm
            initial={EMPTY_ROLE_FORM}
            onSaved={() => router.push(toOrgHref("/roles"))}
            onCancel={() => router.push(toOrgHref("/roles"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
