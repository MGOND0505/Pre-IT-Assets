"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VendorForm, type VendorFormValues } from "@/components/vendors/vendor-form"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

type Vendor = {
  _id: string
  name: string
  contactPerson: string
  email: string
  phone: string
  service: string
  address: string
  contractStart: string | null
  contractEnd: string | null
  notes: string
  customFields: Record<string, unknown>
}

function toDateInputValue(value: string | null) {
  return value ? value.slice(0, 10) : ""
}

function toFormValues(vendor: Vendor): VendorFormValues {
  return {
    _id: vendor._id,
    name: vendor.name,
    contactPerson: vendor.contactPerson,
    email: vendor.email,
    phone: vendor.phone,
    service: vendor.service,
    address: vendor.address,
    contractStart: toDateInputValue(vendor.contractStart),
    contractEnd: toDateInputValue(vendor.contractEnd),
    notes: vendor.notes,
    customFields: vendor.customFields ?? {},
  }
}

export default function EditVendorPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [vendor, setVendor] = React.useState<Vendor | null>(null)
  const [loading, setLoading] = React.useState(true)

  const canWrite = can(user, "vendors", "update")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Vendor>>(`/vendors/${params.id}`)
      setVendor(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load vendor"))
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
  if (!vendor) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Vendor</h1>
        <p className="text-sm text-muted-foreground">{vendor.name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Vendor details</CardTitle>
        </CardHeader>
        <CardContent>
          <VendorForm
            initial={toFormValues(vendor)}
            onSaved={() => router.push(toOrgHref("/vendors"))}
            onCancel={() => router.push(toOrgHref("/vendors"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
