"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"

import { LicenseStatusBadge, LicenseExpiryBadge } from "@/components/licenses/license-status-badge"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useOrgHref } from "@/lib/use-org-href"

type LinkedLicense = {
  _id: string
  licenseId: string
  softwareName: string
  publisher: string
  status: "Active" | "Expired" | "Cancelled"
  expiryDate: string | null
}

type Paginated = { items: LinkedLicense[] }

// Read-only: linking/unlinking a license to an asset happens from the License's own edit form
// (its "Linked assets" picker), not here - this tab is just the reverse view of that same
// License.assets array, one asset's worth.
export function AssetSoftwareTab({ assetId }: { assetId: string }) {
  const toOrgHref = useOrgHref()
  const [licenses, setLicenses] = React.useState<LinkedLicense[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    apiClient
      .get<ApiEnvelope<Paginated>>("/licenses", { params: { asset: assetId, limit: 100 } })
      .then((res) => {
        if (!cancelled) setLicenses(res.data.data.items)
      })
      .catch((err) => {
        if (!cancelled) toast.error(apiErrorMessage(err, "Could not load linked software"))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [assetId])

  if (loading) return <p className="text-sm text-muted-foreground">Loading...</p>

  if (licenses.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No licenses are linked to this asset yet - link one from the license&apos;s own edit form.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-2">
      {licenses.map((l) => (
        <li key={l._id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
          <div>
            <Link href={toOrgHref(`/licenses/${l._id}`)} className="font-medium text-primary hover:underline">
              {l.softwareName}
            </Link>
            <p className="text-xs text-muted-foreground">{l.publisher || "-"}</p>
          </div>
          <div className="flex items-center gap-2">
            <LicenseStatusBadge status={l.status} />
            <LicenseExpiryBadge expiryDate={l.expiryDate} />
          </div>
        </li>
      ))}
    </ul>
  )
}
