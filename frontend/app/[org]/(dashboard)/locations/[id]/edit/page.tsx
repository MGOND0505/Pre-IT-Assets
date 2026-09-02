"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LocationForm, type LocationFormValues } from "@/components/locations/location-form"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

type Location = {
  _id: string
  name: string
  address: string
  city: string
  state: string
  country: string
  status: "Active" | "Inactive"
}

function toFormValues(location: Location): LocationFormValues {
  return {
    _id: location._id,
    name: location.name,
    address: location.address,
    city: location.city,
    state: location.state,
    country: location.country,
  }
}

export default function EditLocationPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [location, setLocation] = React.useState<Location | null>(null)
  const [loading, setLoading] = React.useState(true)

  const canWrite = can(user, "locations", "update")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Location>>(`/locations/${params.id}`)
      setLocation(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load location"))
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
  if (!location) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Location</h1>
        <p className="text-sm text-muted-foreground">{location.name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Location details</CardTitle>
        </CardHeader>
        <CardContent>
          <LocationForm
            initial={toFormValues(location)}
            onSaved={() => router.push(toOrgHref("/locations"))}
            onCancel={() => router.push(toOrgHref("/locations"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
