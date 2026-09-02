"use client"

import * as React from "react"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AssetStatusBadge, type AssetStatus } from "@/components/assets/asset-status-badge"
import { AssetOwnershipBadge, type AssetOwnershipType } from "@/components/assets/asset-ownership-badge"
import { AssetCriticalityBadge, type AssetCriticality } from "@/components/assets/asset-criticality-badge"
import { AssetForm, type AssetFormValues } from "@/components/assets/asset-form"
import { AssetDocumentsTab } from "@/components/assets/asset-documents-tab"
import { AssetHistoryTab } from "@/components/assets/asset-history-tab"
import { AssetSoftwareTab } from "@/components/assets/asset-software-tab"
import { CustomFieldValuesList } from "@/components/custom-fields/custom-fields-section"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

type RefOption = { _id: string; name: string } | null

type Asset = {
  _id: string
  assetId: string
  assetTag: string
  name: string
  category: (RefOption & { prefix?: string; visibleCoreFields?: string[] | null }) | null
  assetType: string
  assetSubType: string
  ownershipType: AssetOwnershipType
  criticality: AssetCriticality
  companyEntity: string
  description: string
  status: AssetStatus
  condition: string
  repairHistory: string
  manufacturer: string
  model: string
  serialNumber: string
  CPU: string
  ram: string
  storage: string
  display: string
  hostname: string
  macAddress: string
  adapterSerialNumber: string
  operatingSystem: string
  osVersion: string
  domainName: string
  antivirusStatus: string
  remarks: string
  purchaseDate: string | null
  purchaseCost: number | null
  vendor: RefOption
  invoiceNumber: string
  contractNumber: string
  depreciationMethod: string
  warrantyStartDate: string | null
  warrantyEndDate: string | null
  warrantyProvider: string
  supportContract: string
  contractStartDate: string | null
  contractEndDate: string | null
  location: RefOption
  floor: string
  subLocation: string
  department: RefOption
  assignedUser: (RefOption & { email?: string; employeeId?: string }) | null
  assignmentDate: string | null
  returnDate: string | null
  assignmentStatus: string
  customFields: Record<string, unknown>
}

const TAB_VALUES = [
  "overview",
  "assignment",
  "assetLocation",
  "hardware",
  "security",
  "financial",
  "condition",
  "customFields",
  "software",
  "documents",
  "history",
] as const
type TabValue = (typeof TAB_VALUES)[number]

const NEEDS_ATTENTION_STATUSES = new Set(["Under Repair", "Lost", "Stolen", "Damaged"])

function hasConditionIssue(asset: Asset): boolean {
  return (
    NEEDS_ATTENTION_STATUSES.has(asset.status) ||
    /damag|poor|replace/i.test(asset.condition) ||
    Boolean(asset.repairHistory.trim())
  )
}

function hasWarrantyIssue(asset: Asset): boolean {
  if (!asset.warrantyEndDate) return false
  const daysRemaining = (new Date(asset.warrantyEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  return daysRemaining <= 30
}

/** Picks a sensible starting tab instead of always defaulting to Overview - e.g. an asset
 * with an open repair issue opens straight to Condition, one with warranty about to lapse
 * opens straight to Financial. Purely a starting point - every tab stays one click away. */
function computeDefaultTab(asset: Asset): TabValue {
  if (hasConditionIssue(asset)) return "condition"
  if (hasWarrantyIssue(asset)) return "financial"
  return "overview"
}

function needsAttentionDot(color: string) {
  return <span className="ml-1.5 inline-block size-1.5 rounded-full" style={{ backgroundColor: color }} />
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

function hasCustomFieldValues(customFields: Record<string, unknown> | null | undefined) {
  return Object.values(customFields ?? {}).some((v) => v !== undefined && v !== null && v !== "")
}

function toFormValues(asset: Asset): AssetFormValues {
  return {
    _id: asset._id,
    assetId: asset.assetId,
    assetTag: asset.assetTag,
    name: asset.name,
    category: asset.category?._id ?? "",
    assetType: asset.assetType,
    assetSubType: asset.assetSubType,
    ownershipType: asset.ownershipType,
    criticality: asset.criticality,
    companyEntity: asset.companyEntity,
    description: asset.description,
    status: asset.status,
    condition: asset.condition,
    repairHistory: asset.repairHistory,
    manufacturer: asset.manufacturer,
    model: asset.model,
    serialNumber: asset.serialNumber,
    CPU: asset.CPU,
    ram: asset.ram,
    storage: asset.storage,
    display: asset.display,
    hostname: asset.hostname,
    macAddress: asset.macAddress,
    adapterSerialNumber: asset.adapterSerialNumber,
    operatingSystem: asset.operatingSystem,
    osVersion: asset.osVersion,
    domainName: asset.domainName,
    antivirusStatus: asset.antivirusStatus,
    remarks: asset.remarks,
    purchaseDate: asset.purchaseDate?.slice(0, 10) ?? "",
    purchaseCost: asset.purchaseCost?.toString() ?? "",
    vendor: asset.vendor?._id ?? "",
    invoiceNumber: asset.invoiceNumber,
    contractNumber: asset.contractNumber,
    depreciationMethod: asset.depreciationMethod,
    warrantyStartDate: asset.warrantyStartDate?.slice(0, 10) ?? "",
    warrantyEndDate: asset.warrantyEndDate?.slice(0, 10) ?? "",
    warrantyProvider: asset.warrantyProvider,
    supportContract: asset.supportContract,
    contractStartDate: asset.contractStartDate?.slice(0, 10) ?? "",
    contractEndDate: asset.contractEndDate?.slice(0, 10) ?? "",
    location: asset.location?._id ?? "",
    floor: asset.floor,
    subLocation: asset.subLocation,
    department: asset.department?._id ?? "",
    assignedUser: asset.assignedUser?._id ?? "",
    assignmentDate: asset.assignmentDate?.slice(0, 10) ?? "",
    returnDate: asset.returnDate?.slice(0, 10) ?? "",
    assignmentStatus: asset.assignmentStatus,
    customFields: asset.customFields ?? {},
  }
}

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [asset, setAsset] = React.useState<Asset | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<TabValue | null>(null)

  const canView = can(user, "assets", "view")
  const canWrite = can(user, "assets", "update")
  const canViewLicenses = can(user, "licenses", "view")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Asset>>(`/assets/${params.id}`)
      setAsset(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load asset"))
    } finally {
      setLoading(false)
    }
  }, [params.id])

  React.useEffect(() => {
    if (canView) load()
  }, [canView, load])

  // Deep-link ?tab= wins if present and valid; otherwise pick the most relevant tab for
  // this specific asset. Runs once per asset load, not on every render.
  React.useEffect(() => {
    if (!asset) return
    const requested = searchParams.get("tab")
    if (requested && (TAB_VALUES as readonly string[]).includes(requested)) {
      setActiveTab(requested as TabValue)
    } else {
      setActiveTab(computeDefaultTab(asset))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [asset?._id])

  function handleTabChange(value: string) {
    setActiveTab(value as TabValue)
    const url = new URL(window.location.href)
    url.searchParams.set("tab", value)
    router.replace(`${url.pathname}?${url.searchParams.toString()}`, { scroll: false })
  }

  if (authLoading || loading) return null
  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }
  if (!asset || !activeTab) return null

  const conditionNeedsAttention = hasConditionIssue(asset)
  const financialNeedsAttention = hasWarrantyIssue(asset)

  // Mirrors asset-form.tsx's isCoreFieldVisible - null (uncurated) shows every Hardware/Security
  // field, matching every category nobody has explicitly configured yet.
  const visibleCoreFields = asset.category?.visibleCoreFields ?? null
  function isCoreFieldVisible(key: string): boolean {
    return visibleCoreFields === null || visibleCoreFields.includes(key)
  }
  const hasVisibleSecurityFields = isCoreFieldVisible("domainName") || isCoreFieldVisible("antivirusStatus")

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{asset.assetId}</h1>
            <AssetStatusBadge status={asset.status} />
          </div>
          <p className="text-sm text-muted-foreground">{asset.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(toOrgHref("/assets"))}>
            Back to list
          </Button>
          {canWrite && <Button onClick={() => setEditing(true)}>Edit</Button>}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList className="flex-wrap">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="assignment">Assignment</TabsTrigger>
              <TabsTrigger value="assetLocation">Location</TabsTrigger>
              <TabsTrigger value="hardware">Hardware</TabsTrigger>
              {hasVisibleSecurityFields && <TabsTrigger value="security">Security</TabsTrigger>}
              <TabsTrigger value="financial">
                Financial
                {financialNeedsAttention && needsAttentionDot("#fab219")}
              </TabsTrigger>
              <TabsTrigger value="condition">
                Condition
                {conditionNeedsAttention && needsAttentionDot("#d03b3b")}
              </TabsTrigger>
              {hasCustomFieldValues(asset.customFields) && <TabsTrigger value="customFields">Custom fields</TabsTrigger>}
              {canViewLicenses && <TabsTrigger value="software">Software</TabsTrigger>}
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Row label="Asset ID" value={asset.assetId} />
                <Row label="Asset tag" value={asset.assetTag} />
                <Row label="Name" value={asset.name} />
                <Row label="Category" value={asset.category?.name} />
                <Row label="Asset type" value={asset.assetType} />
                <Row label="Asset sub-type" value={asset.assetSubType} />
                <Row label="Ownership type" value={<AssetOwnershipBadge ownershipType={asset.ownershipType} />} />
                <Row label="Criticality" value={<AssetCriticalityBadge criticality={asset.criticality} />} />
                <Row label="Company entity" value={asset.companyEntity} />
                <Row label="Status" value={<AssetStatusBadge status={asset.status} />} />
                <Row label="Description" value={asset.description} />
              </div>
            </TabsContent>

            <TabsContent value="assignment">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Row
                  label="Assigned to (system user)"
                  value={
                    asset.assignedUser
                      ? `${asset.assignedUser.name}${asset.assignedUser.employeeId ? ` (${asset.assignedUser.employeeId})` : ""}${asset.assignedUser.email ? ` - ${asset.assignedUser.email}` : ""}`
                      : "Unassigned"
                  }
                />
                <Row label="Department" value={asset.department?.name} />
                <Row label="Assignment status" value={asset.assignmentStatus} />
                <Row label="Assignment date" value={formatDate(asset.assignmentDate)} />
                <Row label="Return date" value={formatDate(asset.returnDate)} />
              </div>
            </TabsContent>

            <TabsContent value="assetLocation">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Row label="Location" value={asset.location?.name} />
                <Row label="Sub-location" value={asset.subLocation} />
                <Row label="Floor" value={asset.floor} />
              </div>
            </TabsContent>

            <TabsContent value="hardware">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Row label="Manufacturer" value={asset.manufacturer} />
                <Row label="Model" value={asset.model} />
                <Row label="Serial number" value={asset.serialNumber} />
                {isCoreFieldVisible("CPU") && <Row label="CPU" value={asset.CPU} />}
                {isCoreFieldVisible("ram") && <Row label="RAM" value={asset.ram} />}
                {isCoreFieldVisible("storage") && <Row label="Storage" value={asset.storage} />}
                {isCoreFieldVisible("display") && <Row label="Display" value={asset.display} />}
                {isCoreFieldVisible("hostname") && <Row label="Hostname" value={asset.hostname} />}
                {isCoreFieldVisible("macAddress") && <Row label="MAC address" value={asset.macAddress} />}
                {isCoreFieldVisible("adapterSerialNumber") && (
                  <Row label="Adapter serial number" value={asset.adapterSerialNumber} />
                )}
                {isCoreFieldVisible("operatingSystem") && <Row label="Operating system" value={asset.operatingSystem} />}
                {isCoreFieldVisible("osVersion") && <Row label="OS version" value={asset.osVersion} />}
                {isCoreFieldVisible("remarks") && <Row label="Remarks" value={asset.remarks} />}
              </div>
            </TabsContent>

            {hasVisibleSecurityFields && (
              <TabsContent value="security">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {isCoreFieldVisible("domainName") && <Row label="Domain name" value={asset.domainName} />}
                  {isCoreFieldVisible("antivirusStatus") && <Row label="Antivirus status" value={asset.antivirusStatus} />}
                </div>
              </TabsContent>
            )}

            <TabsContent value="financial">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Row label="Purchase date" value={formatDate(asset.purchaseDate)} />
                <Row label="Purchase cost" value={asset.purchaseCost != null ? `₹${asset.purchaseCost}` : "-"} />
                <Row label="Vendor" value={asset.vendor?.name} />
                <Row label="Invoice number" value={asset.invoiceNumber} />
                <Row label="Depreciation method" value={asset.depreciationMethod} />
                <Row label="Contract number" value={asset.contractNumber} />
                <Row label="Warranty start" value={formatDate(asset.warrantyStartDate)} />
                <Row label="Warranty end" value={formatDate(asset.warrantyEndDate)} />
                <Row label="Warranty provider" value={asset.warrantyProvider} />
                <Row label="Support contract" value={asset.supportContract} />
                <Row label="Contract start" value={formatDate(asset.contractStartDate)} />
                <Row label="Contract end" value={formatDate(asset.contractEndDate)} />
              </div>
            </TabsContent>

            <TabsContent value="condition">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Row label="Condition" value={asset.condition} />
                <Row label="Repair history" value={asset.repairHistory} />
              </div>
            </TabsContent>

            <TabsContent value="customFields">
              <CustomFieldValuesList module="assets" categoryId={asset.category?._id} values={asset.customFields} />
            </TabsContent>

            {canViewLicenses && (
              <TabsContent value="software">
                <AssetSoftwareTab assetId={asset._id} />
              </TabsContent>
            )}

            <TabsContent value="documents">
              <AssetDocumentsTab assetId={asset._id} />
            </TabsContent>

            <TabsContent value="history">
              <AssetHistoryTab assetId={asset._id} />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent size="full">
          <DialogHeader>
            <DialogTitle>Edit {asset.assetId}</DialogTitle>
          </DialogHeader>
          <AssetForm
            initial={toFormValues(asset)}
            onCancel={() => setEditing(false)}
            onSaved={() => {
              setEditing(false)
              load()
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
