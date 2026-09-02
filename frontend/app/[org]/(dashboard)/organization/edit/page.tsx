"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  OrganizationDetailsForm,
  toOrganizationDetailsFormValues,
  type OrganizationDetails,
} from "@/components/organizations/organization-details-form"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"

export default function EditOrganizationPage() {
  const params = useParams<{ org: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [organization, setOrganization] = React.useState<OrganizationDetails | null>(null)
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<{ organization: OrganizationDetails }>>(`/organizations/${params.org}`)
      setOrganization(res.data.data.organization)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load organization"))
    } finally {
      setLoading(false)
    }
  }, [params.org])

  React.useEffect(() => {
    if (user?.role === "superAdmin") load()
  }, [user, load])

  if (authLoading) return null
  if (user?.role !== "superAdmin") {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }
  if (loading || !organization) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Organization</h1>
        <p className="text-sm text-muted-foreground">{organization.name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Organization details</CardTitle>
        </CardHeader>
        <CardContent>
          <OrganizationDetailsForm
            idOrSlug={params.org}
            initial={toOrganizationDetailsFormValues(organization)}
            onSaved={() => router.push(`/${params.org}/organization`)}
            onCancel={() => router.push(`/${params.org}/organization`)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
