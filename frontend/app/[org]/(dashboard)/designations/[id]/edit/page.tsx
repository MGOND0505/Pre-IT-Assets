"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DesignationForm, type DesignationFormValues } from "@/components/designations/designation-form"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

type Designation = { _id: string; name: string; description: string; status: "Active" | "Inactive" }

function toFormValues(designation: Designation): DesignationFormValues {
  return { _id: designation._id, name: designation.name, description: designation.description }
}

export default function EditDesignationPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [designation, setDesignation] = React.useState<Designation | null>(null)
  const [loading, setLoading] = React.useState(true)

  const canWrite = can(user, "designations", "update")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Designation>>(`/designations/${params.id}`)
      setDesignation(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load designation"))
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
  if (!designation) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Designation</h1>
        <p className="text-sm text-muted-foreground">{designation.name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Designation details</CardTitle>
        </CardHeader>
        <CardContent>
          <DesignationForm
            initial={toFormValues(designation)}
            onSaved={() => router.push(toOrgHref("/designations"))}
            onCancel={() => router.push(toOrgHref("/designations"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
