"use client"

import { useRouter } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LocationForm, EMPTY_LOCATION_FORM } from "@/components/locations/location-form"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

export default function AddLocationPage() {
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()

  const canCreate = can(user, "locations", "create")

  if (authLoading) return null
  if (!canCreate) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Location</h1>
        <p className="text-sm text-muted-foreground">Register a new office or site location.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New location</CardTitle>
        </CardHeader>
        <CardContent>
          <LocationForm
            initial={EMPTY_LOCATION_FORM}
            onSaved={() => router.push(toOrgHref("/locations"))}
            onCancel={() => router.push(toOrgHref("/locations"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
