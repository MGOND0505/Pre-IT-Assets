"use client"

import { useRouter } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DepartmentForm, EMPTY_DEPARTMENT_FORM } from "@/components/departments/department-form"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

export default function AddDepartmentPage() {
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()

  const canCreate = can(user, "departments", "create")

  if (authLoading) return null
  if (!canCreate) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Department</h1>
        <p className="text-sm text-muted-foreground">Register a new department used across the system.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New department</CardTitle>
        </CardHeader>
        <CardContent>
          <DepartmentForm
            initial={EMPTY_DEPARTMENT_FORM}
            onSaved={() => router.push(toOrgHref("/departments"))}
            onCancel={() => router.push(toOrgHref("/departments"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
