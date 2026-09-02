"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { type AssetStatus } from "@/components/assets/asset-status-badge"
import { type AssetOwnershipType } from "@/components/assets/asset-ownership-badge"
import { type AssetCriticality } from "@/components/assets/asset-criticality-badge"
import { AssetForm, type AssetFormValues } from "@/components/assets/asset-form"
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
  category: (RefOption & { prefix?: string }) | null
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

export default function EditAssetPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [asset, setAsset] = React.useState<Asset | null>(null)
  const [loading, setLoading] = React.useState(true)

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
    if (canWrite) load()
  }, [canWrite, load])

  if (authLoading || loading) return null
  if (!canWrite) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }
  if (!asset) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit {asset.assetId}</h1>
        <p className="text-sm text-muted-foreground">{asset.name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Asset details</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetForm
            initial={toFormValues(asset)}
            onCancel={() => router.push(toOrgHref(`/assets/${asset._id}`))}
            onSaved={() => router.push(toOrgHref(`/assets/${asset._id}`))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
