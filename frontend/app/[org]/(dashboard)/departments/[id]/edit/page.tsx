"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DepartmentForm, type DepartmentFormValues } from "@/components/departments/department-form"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

type Department = { _id: string; name: string; description: string; status: "Active" | "Inactive" }

function toFormValues(department: Department): DepartmentFormValues {
  return { _id: department._id, name: department.name, description: department.description }
}

export default function EditDepartmentPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [department, setDepartment] = React.useState<Department | null>(null)
  const [loading, setLoading] = React.useState(true)

  const canWrite = can(user, "departments", "update")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Department>>(`/departments/${params.id}`)
      setDepartment(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load department"))
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
  if (!department) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Department</h1>
        <p className="text-sm text-muted-foreground">{department.name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Department details</CardTitle>
        </CardHeader>
        <CardContent>
          <DepartmentForm
            initial={toFormValues(department)}
            onSaved={() => router.push(toOrgHref("/departments"))}
            onCancel={() => router.push(toOrgHref("/departments"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
