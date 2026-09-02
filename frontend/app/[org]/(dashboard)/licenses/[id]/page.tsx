"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { LicenseStatusBadge, LicenseExpiryBadge } from "@/components/licenses/license-status-badge"
import { LicenseForm, type LicenseFormValues } from "@/components/licenses/license-form"
import { CustomFieldValuesList } from "@/components/custom-fields/custom-fields-section"
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
  assignedUsers: { _id: string; name: string; email: string; employeeId?: string }[]
  assets: { _id: string; assetId: string; name: string }[]
  department: RefOption
  status: "Active" | "Expired" | "Cancelled"
  notes: string
  customFields: Record<string, unknown>
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 py-1.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm">{value || "-"}</span>
    </div>
  )
}

function formatDate(value: string | null) {
  return value ? new Date(value).toLocaleDateString() : "-"
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

export default function LicenseDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [license, setLicense] = React.useState<License | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState(false)
  const [pendingDelete, setPendingDelete] = React.useState(false)

  const canView = can(user, "licenses", "view")
  const canWrite = can(user, "licenses", "update")
  const canDelete = can(user, "licenses", "delete")

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
    if (canView) load()
  }, [canView, load])

  async function handleDelete() {
    if (!license) return
    try {
      await apiClient.delete(`/licenses/${license._id}`)
      toast.success("License deleted")
      router.push(toOrgHref("/licenses"))
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete license"))
    } finally {
      setPendingDelete(false)
    }
  }

  if (authLoading || loading) return null
  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }
  if (!license) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{license.licenseId}</h1>
            <LicenseStatusBadge status={license.status} />
          </div>
          <p className="text-sm text-muted-foreground">{license.softwareName}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(toOrgHref("/licenses"))}>
            Back to list
          </Button>
          {canWrite && <Button onClick={() => setEditing(true)}>Edit</Button>}
          {canDelete && (
            <Button variant="destructive" onClick={() => setPendingDelete(true)}>
              Delete
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          <Row label="Software" value={license.softwareName} />
          <Row label="Product" value={license.productName} />
          <Row label="Publisher" value={license.publisher} />
          <Row label="Category" value={license.category?.name} />
          <Row label="License type" value={license.licenseType} />
          <Row label="Vendor" value={license.vendor?.name} />
          <Row label="Department" value={license.department?.name} />
          <Row label="Purchase date" value={formatDate(license.purchaseDate)} />
          <Row label="Start date" value={formatDate(license.startDate)} />
          <Row label="Expiry" value={<LicenseExpiryBadge expiryDate={license.expiryDate} />} />
          <Row label="Renewal date" value={formatDate(license.renewalDate)} />
          <Row label="Seats" value={`${license.assignedUsers.length} / ${license.totalLicenses}`} />
          <Row label="Notes" value={license.notes} />
        </CardContent>
      </Card>

      {Object.values(license.customFields ?? {}).some((v) => v !== undefined && v !== null && v !== "") && (
        <Card>
          <CardContent className="pt-6">
            <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Custom fields</h3>
            <CustomFieldValuesList module="licenses" values={license.customFields} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Assigned users</h3>
          {license.assignedUsers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No one is assigned to this license yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {license.assignedUsers.map((u) => (
                <li key={u._id} className="rounded-md border p-2 text-sm">
                  {u.name}
                  {u.employeeId ? ` (${u.employeeId})` : ""} - {u.email}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Linked assets</h3>
          {license.assets.length === 0 ? (
            <p className="text-sm text-muted-foreground">This license isn&apos;t linked to any assets yet - edit it to add some.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {license.assets.map((a) => (
                <li key={a._id} className="rounded-md border p-2 text-sm">
                  <Link href={toOrgHref(`/assets/${a._id}`)} className="text-primary hover:underline">
                    {a.assetId}
                  </Link>{" "}
                  - {a.name}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent size="full">
          <DialogHeader>
            <DialogTitle>Edit {license.licenseId}</DialogTitle>
          </DialogHeader>
          <LicenseForm
            initial={toFormValues(license)}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false)
              load()
            }}
          />
        </DialogContent>
      </Dialog>

      {pendingDelete && (
        <ConfirmDialog
          open
          onOpenChange={setPendingDelete}
          title={`Delete "${license.licenseId}"?`}
          description="This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={handleDelete}
        />
      )}
    </div>
  )
}
