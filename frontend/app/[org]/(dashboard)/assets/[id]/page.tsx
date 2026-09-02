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
import { AssetForm, type AssetFormValues } from "@/components/assets/asset-form"
import { AssetDocumentsTab } from "@/components/assets/asset-documents-tab"
import { AssetHistoryTab } from "@/components/assets/asset-history-tab"
import { CustomFieldValuesList } from "@/components/custom-fields/custom-fields-section"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

type RefOption = { _id: string; name: string } | null

type Asset = {
  _id: string
  assetId: string
  name: string
  category: (RefOption & { prefix?: string }) | null
  assetType: string
  ownershipType: AssetOwnershipType
  deviceType: string
  status: AssetStatus
  condition: string
  conditionNotes: string
  approvalStatus: string
  repairHistory: string
  color: string
  manufacturer: string
  model: string
  serialNumber: string
  serviceTag: string
  imei: string
  processor: string
  laptopGeneration: string
  graphicsCard: string
  ram: string
  storage: string
  hostname: string
  ipAddress: string
  macAddress: string
  adapterSerialNumber: string
  miscAccessories: string
  configuration: string
  operatingSystem: string
  operatingSystemLicense: string
  adMember: string
  antivirusInstalled: string
  remoteSoftware: string
  emailLicense: string
  canvaLicense: string
  microsoftOffice: string
  microsoftProject: string
  powerBi: string
  autoCad: string
  zwCad: string
  photoshop: string
  creativeCloudPro: string
  illustrator: string
  acrobatPro: string
  sketchUpPro: string
  rocketReachPro: string
  d5Render: string
  zoomLicense: string
  sharedFolderAccess: string
  purchaseDate: string | null
  purchaseCost: number | null
  quantity: number | null
  vendor: RefOption
  companyName: string
  poNumber: string
  invoiceNumber: string
  warrantyStart: string | null
  warrantyEnd: string | null
  amcStart: string | null
  amcEnd: string | null
  location: RefOption
  subLocation: string
  department: RefOption
  assignedUser: (RefOption & { email?: string }) | null
  userAccessLevel: string
  employeeId: string
  employeeName: string
  designation: string
  email: string
  currentOwner: string
  previousOwner: string
  notes: string
  customFields: Record<string, unknown>
}

const TAB_VALUES = [
  "overview",
  "employee",
  "hardware",
  "software",
  "financial",
  "condition",
  "customFields",
  "documents",
  "history",
] as const
type TabValue = (typeof TAB_VALUES)[number]

const NEEDS_ATTENTION_STATUSES = new Set(["Under Repair", "Lost", "Stolen", "Damaged"])

function hasConditionIssue(asset: Asset): boolean {
  return (
    NEEDS_ATTENTION_STATUSES.has(asset.status) ||
    /damag|poor|replace/i.test(asset.condition) ||
    /pending/i.test(asset.approvalStatus) ||
    Boolean(asset.repairHistory.trim())
  )
}

function hasWarrantyIssue(asset: Asset): boolean {
  if (!asset.warrantyEnd) return false
  const daysRemaining = (new Date(asset.warrantyEnd).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
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

function hasCustomFieldValues(customFields: Record<string, unknown>) {
  return Object.values(customFields).some((v) => v !== undefined && v !== null && v !== "")
}

function toFormValues(asset: Asset): AssetFormValues {
  return {
    _id: asset._id,
    assetId: asset.assetId,
    name: asset.name,
    category: asset.category?._id ?? "",
    assetType: asset.assetType,
    ownershipType: asset.ownershipType,
    deviceType: asset.deviceType,
    status: asset.status,
    condition: asset.condition,
    conditionNotes: asset.conditionNotes,
    approvalStatus: asset.approvalStatus,
    repairHistory: asset.repairHistory,
    color: asset.color,
    manufacturer: asset.manufacturer,
    model: asset.model,
    serialNumber: asset.serialNumber,
    serviceTag: asset.serviceTag,
    imei: asset.imei,
    processor: asset.processor,
    laptopGeneration: asset.laptopGeneration,
    graphicsCard: asset.graphicsCard,
    ram: asset.ram,
    storage: asset.storage,
    hostname: asset.hostname,
    ipAddress: asset.ipAddress,
    macAddress: asset.macAddress,
    adapterSerialNumber: asset.adapterSerialNumber,
    miscAccessories: asset.miscAccessories,
    configuration: asset.configuration,
    operatingSystem: asset.operatingSystem,
    operatingSystemLicense: asset.operatingSystemLicense,
    adMember: asset.adMember,
    antivirusInstalled: asset.antivirusInstalled,
    remoteSoftware: asset.remoteSoftware,
    emailLicense: asset.emailLicense,
    canvaLicense: asset.canvaLicense,
    microsoftOffice: asset.microsoftOffice,
    microsoftProject: asset.microsoftProject,
    powerBi: asset.powerBi,
    autoCad: asset.autoCad,
    zwCad: asset.zwCad,
    photoshop: asset.photoshop,
    creativeCloudPro: asset.creativeCloudPro,
    illustrator: asset.illustrator,
    acrobatPro: asset.acrobatPro,
    sketchUpPro: asset.sketchUpPro,
    rocketReachPro: asset.rocketReachPro,
    d5Render: asset.d5Render,
    zoomLicense: asset.zoomLicense,
    sharedFolderAccess: asset.sharedFolderAccess,
    purchaseDate: asset.purchaseDate?.slice(0, 10) ?? "",
    purchaseCost: asset.purchaseCost?.toString() ?? "",
    quantity: asset.quantity?.toString() ?? "",
    vendor: asset.vendor?._id ?? "",
    companyName: asset.companyName,
    poNumber: asset.poNumber,
    invoiceNumber: asset.invoiceNumber,
    warrantyStart: asset.warrantyStart?.slice(0, 10) ?? "",
    warrantyEnd: asset.warrantyEnd?.slice(0, 10) ?? "",
    amcStart: asset.amcStart?.slice(0, 10) ?? "",
    amcEnd: asset.amcEnd?.slice(0, 10) ?? "",
    location: asset.location?._id ?? "",
    subLocation: asset.subLocation,
    department: asset.department?._id ?? "",
    assignedUser: asset.assignedUser?._id ?? "",
    userAccessLevel: asset.userAccessLevel,
    employeeId: asset.employeeId,
    employeeName: asset.employeeName,
    designation: asset.designation,
    email: asset.email,
    currentOwner: asset.currentOwner,
    previousOwner: asset.previousOwner,
    notes: asset.notes,
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
              <TabsTrigger value="employee">Employee</TabsTrigger>
              <TabsTrigger value="hardware">Hardware</TabsTrigger>
              <TabsTrigger value="software">Software licenses</TabsTrigger>
              <TabsTrigger value="financial">
                Financial
                {financialNeedsAttention && needsAttentionDot("#fab219")}
              </TabsTrigger>
              <TabsTrigger value="condition">
                Condition
                {conditionNeedsAttention && needsAttentionDot("#d03b3b")}
              </TabsTrigger>
              {hasCustomFieldValues(asset.customFields) && <TabsTrigger value="customFields">Custom fields</TabsTrigger>}
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Row label="Asset ID" value={asset.assetId} />
                <Row label="Name" value={asset.name} />
                <Row label="Category" value={asset.category?.name} />
                <Row label="Device type" value={asset.deviceType} />
                <Row label="Asset type" value={asset.assetType} />
                <Row label="Ownership type" value={<AssetOwnershipBadge ownershipType={asset.ownershipType} />} />
                <Row label="Status" value={<AssetStatusBadge status={asset.status} />} />
                <Row label="Color" value={asset.color} />
                <Row label="Location" value={asset.location?.name} />
                <Row label="Sub-location" value={asset.subLocation} />
                <Row label="Department" value={asset.department?.name} />
              </div>
            </TabsContent>

            <TabsContent value="employee">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Row
                  label="Assigned to (system user)"
                  value={
                    asset.assignedUser ? `${asset.assignedUser.name}${asset.assignedUser.email ? ` (${asset.assignedUser.email})` : ""}` : "Unassigned"
                  }
                />
                <Row label="Employee ID" value={asset.employeeId} />
                <Row label="Employee name" value={asset.employeeName} />
                <Row label="Designation" value={asset.designation} />
                <Row label="Email ID" value={asset.email} />
                <Row label="User access" value={asset.userAccessLevel} />
                <Row label="Current owner" value={asset.currentOwner} />
                <Row label="Previous owner" value={asset.previousOwner} />
              </div>
            </TabsContent>

            <TabsContent value="hardware">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Row label="Manufacturer" value={asset.manufacturer} />
                <Row label="Model" value={asset.model} />
                <Row label="Serial number" value={asset.serialNumber} />
                <Row label="Service tag" value={asset.serviceTag} />
                <Row label="IMEI" value={asset.imei} />
                <Row label="Processor" value={asset.processor} />
                <Row label="Laptop generation" value={asset.laptopGeneration} />
                <Row label="Graphics card" value={asset.graphicsCard} />
                <Row label="RAM" value={asset.ram} />
                <Row label="Storage" value={asset.storage} />
                <Row label="Hostname" value={asset.hostname} />
                <Row label="IP address" value={asset.ipAddress} />
                <Row label="MAC address" value={asset.macAddress} />
                <Row label="Adapter serial number" value={asset.adapterSerialNumber} />
                <Row label="Misc. accessories" value={asset.miscAccessories} />
                <Row label="Configuration" value={asset.configuration} />
              </div>
            </TabsContent>

            <TabsContent value="software">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Row label="Operating system" value={asset.operatingSystem} />
                <Row label="OS license" value={asset.operatingSystemLicense} />
                <Row label="AD member" value={asset.adMember} />
                <Row label="Antivirus installed" value={asset.antivirusInstalled} />
                <Row label="Remote software" value={asset.remoteSoftware} />
                <Row label="Email license" value={asset.emailLicense} />
                <Row label="Canva license" value={asset.canvaLicense} />
                <Row label="Microsoft Office" value={asset.microsoftOffice} />
                <Row label="Microsoft Project" value={asset.microsoftProject} />
                <Row label="Power BI" value={asset.powerBi} />
                <Row label="AutoCAD" value={asset.autoCad} />
                <Row label="ZWCAD" value={asset.zwCad} />
                <Row label="Photoshop" value={asset.photoshop} />
                <Row label="Creative Cloud Pro" value={asset.creativeCloudPro} />
                <Row label="Illustrator" value={asset.illustrator} />
                <Row label="Acrobat Pro" value={asset.acrobatPro} />
                <Row label="SketchUp Pro" value={asset.sketchUpPro} />
                <Row label="RocketReach Pro" value={asset.rocketReachPro} />
                <Row label="D5 Render" value={asset.d5Render} />
                <Row label="Zoom license" value={asset.zoomLicense} />
                <Row label="Shared folder access" value={asset.sharedFolderAccess} />
              </div>
            </TabsContent>

            <TabsContent value="financial">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Row label="Purchase date" value={formatDate(asset.purchaseDate)} />
                <Row label="Purchase cost" value={asset.purchaseCost != null ? `₹${asset.purchaseCost}` : "-"} />
                <Row label="Quantity" value={asset.quantity ?? "-"} />
                <Row label="Vendor" value={asset.vendor?.name} />
                <Row label="Company name" value={asset.companyName} />
                <Row label="PO number" value={asset.poNumber} />
                <Row label="Invoice number" value={asset.invoiceNumber} />
                <Row label="Warranty start" value={formatDate(asset.warrantyStart)} />
                <Row label="Warranty end" value={formatDate(asset.warrantyEnd)} />
                <Row label="AMC start" value={formatDate(asset.amcStart)} />
                <Row label="AMC end" value={formatDate(asset.amcEnd)} />
              </div>
            </TabsContent>

            <TabsContent value="condition">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Row label="Condition" value={asset.condition} />
                <Row label="Approval status" value={asset.approvalStatus} />
                <Row label="Condition notes" value={asset.conditionNotes} />
                <Row label="Repair history" value={asset.repairHistory} />
                <Row label="Notes" value={asset.notes} />
              </div>
            </TabsContent>

            <TabsContent value="customFields">
              <CustomFieldValuesList module="assets" values={asset.customFields} />
            </TabsContent>

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
