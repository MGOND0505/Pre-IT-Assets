"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AssetStatusBadge, type AssetStatus } from "@/components/assets/asset-status-badge"
import { AssetForm, type AssetFormValues } from "@/components/assets/asset-form"
import { AssetDocumentsTab } from "@/components/assets/asset-documents-tab"
import { AssetHistoryTab } from "@/components/assets/asset-history-tab"
import { AssetWorkflowActions } from "@/components/assets/asset-workflow-actions"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { hasPermission, PERM } from "@/lib/permissions"

type RefOption = { _id: string; name: string } | null

type Asset = {
  _id: string
  assetId: string
  name: string
  category: (RefOption & { prefix?: string }) | null
  assetType: string
  status: AssetStatus
  condition: string
  manufacturer: string
  model: string
  serialNumber: string
  serviceTag: string
  hostname: string
  ipAddress: string
  macAddress: string
  operatingSystem: string
  configuration: string
  purchaseDate: string | null
  purchaseCost: number | null
  vendor: RefOption
  poNumber: string
  invoiceNumber: string
  warrantyStart: string | null
  warrantyEnd: string | null
  amcStart: string | null
  amcEnd: string | null
  location: RefOption
  department: RefOption
  notes: string
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

function toFormValues(asset: Asset): AssetFormValues {
  return {
    _id: asset._id,
    name: asset.name,
    category: asset.category?._id ?? "",
    assetType: asset.assetType,
    status: asset.status,
    condition: asset.condition,
    manufacturer: asset.manufacturer,
    model: asset.model,
    serialNumber: asset.serialNumber,
    serviceTag: asset.serviceTag,
    hostname: asset.hostname,
    ipAddress: asset.ipAddress,
    macAddress: asset.macAddress,
    operatingSystem: asset.operatingSystem,
    configuration: asset.configuration,
    purchaseDate: asset.purchaseDate?.slice(0, 10) ?? "",
    purchaseCost: asset.purchaseCost?.toString() ?? "",
    vendor: asset.vendor?._id ?? "",
    poNumber: asset.poNumber,
    invoiceNumber: asset.invoiceNumber,
    warrantyStart: asset.warrantyStart?.slice(0, 10) ?? "",
    warrantyEnd: asset.warrantyEnd?.slice(0, 10) ?? "",
    amcStart: asset.amcStart?.slice(0, 10) ?? "",
    amcEnd: asset.amcEnd?.slice(0, 10) ?? "",
    location: asset.location?._id ?? "",
    department: asset.department?._id ?? "",
    notes: asset.notes,
  }
}

export default function AssetDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [asset, setAsset] = React.useState<Asset | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [editing, setEditing] = React.useState(false)

  const canView = hasPermission(user, PERM.ASSETS_READ)
  const canWrite = hasPermission(user, PERM.ASSETS_WRITE)

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

  if (authLoading || loading) return null
  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }
  if (!asset) return null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{asset.assetId}</h1>
            <AssetStatusBadge status={asset.status} />
          </div>
          <p className="text-sm text-muted-foreground">{asset.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/assets")}>
            Back to list
          </Button>
          {canWrite && <Button onClick={() => setEditing(true)}>Edit</Button>}
        </div>
      </div>

      <AssetWorkflowActions assetId={asset._id} onDone={load} />

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="specifications">Specifications</TabsTrigger>
              <TabsTrigger value="financial">Financial</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-3 gap-4">
                <Row label="Asset ID" value={asset.assetId} />
                <Row label="Name" value={asset.name} />
                <Row label="Category" value={asset.category?.name} />
                <Row label="Asset type" value={asset.assetType} />
                <Row label="Status" value={<AssetStatusBadge status={asset.status} />} />
                <Row label="Condition" value={asset.condition} />
                <Row label="Location" value={asset.location?.name} />
                <Row label="Department" value={asset.department?.name} />
                <Row label="Notes" value={asset.notes} />
              </div>
            </TabsContent>

            <TabsContent value="specifications">
              <div className="grid grid-cols-3 gap-4">
                <Row label="Manufacturer" value={asset.manufacturer} />
                <Row label="Model" value={asset.model} />
                <Row label="Serial number" value={asset.serialNumber} />
                <Row label="Service tag" value={asset.serviceTag} />
                <Row label="Hostname" value={asset.hostname} />
                <Row label="IP address" value={asset.ipAddress} />
                <Row label="MAC address" value={asset.macAddress} />
                <Row label="Operating system" value={asset.operatingSystem} />
                <Row label="Configuration" value={asset.configuration} />
              </div>
            </TabsContent>

            <TabsContent value="financial">
              <div className="grid grid-cols-3 gap-4">
                <Row label="Purchase date" value={formatDate(asset.purchaseDate)} />
                <Row label="Purchase cost" value={asset.purchaseCost != null ? `₹${asset.purchaseCost}` : "-"} />
                <Row label="Vendor" value={asset.vendor?.name} />
                <Row label="PO number" value={asset.poNumber} />
                <Row label="Invoice number" value={asset.invoiceNumber} />
                <Row label="Warranty start" value={formatDate(asset.warrantyStart)} />
                <Row label="Warranty end" value={formatDate(asset.warrantyEnd)} />
                <Row label="AMC start" value={formatDate(asset.amcStart)} />
                <Row label="AMC end" value={formatDate(asset.amcEnd)} />
              </div>
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
        <DialogContent className="max-w-3xl">
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
