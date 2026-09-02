"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LicenseForm, type LicenseFormValues } from "@/components/licenses/license-form"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

type RefOption = { _id: string; name: string } | null

type License = {
  _id: string
  licenseId: string
  softwareName: string
  productName: string
  publisher: string
  category: RefOption
  licenseType: string
  vendor: RefOption
  purchaseDate: string | null
  startDate: string | null
  expiryDate: string | null
  renewalDate: string | null
  totalLicenses: number
  assignedUsers: { _id: string; name: string }[]
  department: RefOption
  status: "Active" | "Expired" | "Cancelled"
  notes: string
  customFields: Record<string, unknown>
}

function toFormValues(license: License): LicenseFormValues {
  return {
    _id: license._id,
    softwareName: license.softwareName,
    productName: license.productName,
    publisher: license.publisher,
    category: license.category?._id ?? "",
    licenseType: license.licenseType,
    vendor: license.vendor?._id ?? "",
    purchaseDate: license.purchaseDate?.slice(0, 10) ?? "",
    startDate: license.startDate?.slice(0, 10) ?? "",
    expiryDate: license.expiryDate?.slice(0, 10) ?? "",
    renewalDate: license.renewalDate?.slice(0, 10) ?? "",
    totalLicenses: String(license.totalLicenses),
    assignedUsers: license.assignedUsers.map((u) => u._id),
    department: license.department?._id ?? "",
    status: license.status,
    notes: license.notes,
    customFields: license.customFields ?? {},
  }
}

export default function EditLicensePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [license, setLicense] = React.useState<License | null>(null)
  const [loading, setLoading] = React.useState(true)

  const canWrite = can(user, "licenses", "update")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<License>>(`/licenses/${params.id}`)
      setLicense(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load license"))
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
  if (!license) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit {license.licenseId}</h1>
        <p className="text-sm text-muted-foreground">{license.softwareName}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>License details</CardTitle>
        </CardHeader>
        <CardContent>
          <LicenseForm
            initial={toFormValues(license)}
            onCancel={() => router.push(toOrgHref(`/licenses/${license._id}`))}
            onSaved={() => router.push(toOrgHref(`/licenses/${license._id}`))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
