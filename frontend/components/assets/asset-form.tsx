"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CustomFieldsSection } from "@/components/custom-fields/custom-fields-section"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import {
  useAssetCategoryOptions,
  useCustomFieldDefinitionOptions,
  useDepartmentOptions,
  useLocationOptions,
  useUserOptions,
  useVendorOptions,
} from "@/lib/use-lookup-options"
import { ASSET_STATUSES } from "@/components/assets/asset-status-badge"
import { ASSET_OWNERSHIP_TYPES } from "@/components/assets/asset-ownership-badge"
import { ASSET_CRITICALITY_LEVELS } from "@/components/assets/asset-criticality-badge"

const NONE = "__none__"

const ASSET_ASSIGNMENT_STATUSES = ["Unassigned", "Assigned", "Shared", "Pool", "Temporary"] as const
const ASSET_DEPRECIATION_METHODS = ["Straight-Line", "None"] as const

export type AssetFormValues = {
  _id?: string
  assetId?: string
  assetTag: string
  name: string
  category: string
  assetType: string
  assetSubType: string
  ownershipType: string
  criticality: string
  companyEntity: string
  description: string
  deviceType: string
  status: string
  condition: string
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
  purchaseDate: string
  purchaseCost: string
  quantity: string
  vendor: string
  purchaseOrderNumber: string
  invoiceNumber: string
  currency: string
  contractNumber: string
  costCenter: string
  budgetCode: string
  depreciationMethod: string
  depreciationStartDate: string
  warrantyStartDate: string
  warrantyEndDate: string
  warrantyProvider: string
  supportContract: string
  contractStartDate: string
  contractEndDate: string
  location: string
  building: string
  floor: string
  room: string
  subLocation: string
  department: string
  assignedUser: string
  assignmentDate: string
  returnDate: string
  assignmentStatus: string
  customFields: Record<string, unknown>
}

export const EMPTY_ASSET_FORM: AssetFormValues = {
  assetId: "",
  assetTag: "",
  name: "",
  category: "",
  assetType: "",
  assetSubType: "",
  ownershipType: "Own",
  criticality: "Medium",
  companyEntity: "",
  description: "",
  deviceType: "",
  status: "In Stock",
  condition: "",
  repairHistory: "",
  color: "",
  manufacturer: "",
  model: "",
  serialNumber: "",
  serviceTag: "",
  imei: "",
  processor: "",
  laptopGeneration: "",
  graphicsCard: "",
  ram: "",
  storage: "",
  hostname: "",
  ipAddress: "",
  macAddress: "",
  adapterSerialNumber: "",
  miscAccessories: "",
  configuration: "",
  operatingSystem: "",
  operatingSystemLicense: "",
  adMember: "",
  antivirusInstalled: "",
  remoteSoftware: "",
  emailLicense: "",
  canvaLicense: "",
  microsoftOffice: "",
  microsoftProject: "",
  powerBi: "",
  autoCad: "",
  zwCad: "",
  photoshop: "",
  creativeCloudPro: "",
  illustrator: "",
  acrobatPro: "",
  sketchUpPro: "",
  rocketReachPro: "",
  d5Render: "",
  zoomLicense: "",
  sharedFolderAccess: "",
  purchaseDate: "",
  purchaseCost: "",
  quantity: "",
  vendor: "",
  purchaseOrderNumber: "",
  invoiceNumber: "",
  currency: "",
  contractNumber: "",
  costCenter: "",
  budgetCode: "",
  depreciationMethod: "None",
  depreciationStartDate: "",
  warrantyStartDate: "",
  warrantyEndDate: "",
  warrantyProvider: "",
  supportContract: "",
  contractStartDate: "",
  contractEndDate: "",
  location: "",
  building: "",
  floor: "",
  room: "",
  subLocation: "",
  department: "",
  assignedUser: "",
  assignmentDate: "",
  returnDate: "",
  assignmentStatus: "Unassigned",
  customFields: {},
}

function Field({
  label,
  id,
  value,
  onChange,
  type = "text",
}: {
  label: string
  id: string
  value: string
  onChange: (value: string) => void
  type?: string
}) {
  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

export function AssetForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: AssetFormValues
  onSaved: (assetId: string) => void
  onCancel?: () => void
}) {
  const [form, setForm] = React.useState<AssetFormValues>(initial)
  const [submitting, setSubmitting] = React.useState(false)

  const { user } = useAuth()
  const canEditAssetId = can(user, "assets", "editAssetId")

  const { items: categories } = useAssetCategoryOptions()
  const { items: vendors } = useVendorOptions()
  const { items: locations } = useLocationOptions()
  const { items: departments } = useDepartmentOptions()
  const { items: users } = useUserOptions()
  // Gates the "Custom fields" tab's very existence, not just its contents - a form with none
  // configured must look exactly like it did before this feature existed.
  const { items: customFieldDefinitions } = useCustomFieldDefinitionOptions("assets")
  const hasCustomFields = customFieldDefinitions.length > 0

  function set<K extends keyof AssetFormValues>(field: K) {
    return (value: string) => setForm((f) => ({ ...f, [field]: value }))
  }

  function setSelect<K extends keyof AssetFormValues>(field: K) {
    return (value: string | null) => setForm((f) => ({ ...f, [field]: value ?? "" }))
  }

  const isEdit = Boolean(form._id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name.trim() || !form.category) {
      toast.error("Name and category are required")
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        ...form,
        assetId: form.assetId || undefined,
        purchaseCost: form.purchaseCost ? Number(form.purchaseCost) : undefined,
        quantity: form.quantity ? Number(form.quantity) : undefined,
        purchaseDate: form.purchaseDate || undefined,
        depreciationStartDate: form.depreciationStartDate || undefined,
        warrantyStartDate: form.warrantyStartDate || undefined,
        warrantyEndDate: form.warrantyEndDate || undefined,
        contractStartDate: form.contractStartDate || undefined,
        contractEndDate: form.contractEndDate || undefined,
        assignmentDate: form.assignmentDate || undefined,
        returnDate: form.returnDate || undefined,
        vendor: form.vendor || undefined,
        location: form.location || undefined,
        department: form.department || undefined,
        assignedUser: form.assignedUser || null,
      }

      if (isEdit && form._id) {
        const res = await apiClient.put(`/assets/${form._id}`, payload)
        toast.success("Asset updated")
        onSaved(res.data.data._id)
      } else {
        const res = await apiClient.post("/assets", payload)
        toast.success(`Asset created: ${res.data.data.assetId}`)
        onSaved(res.data.data._id)
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save asset"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <Tabs defaultValue="basic" className="gap-6">
        {/* Six tabs never all fit on one line at typical dialog/page widths - rather than
            wrapping to a second row (which the fixed-height tab bar doesn't grow to fit,
            causing it to visually collide with the form fields below), this scrolls
            horizontally instead. Each trigger keeps `shrink-0` so its label is never squeezed
            or clipped - the row overflows and scrolls, it never wraps. */}
        <TabsList className="w-full justify-start gap-2 overflow-x-auto no-scrollbar">
          <TabsTrigger value="basic" className="shrink-0">Basic</TabsTrigger>
          <TabsTrigger value="assignment" className="shrink-0">Assignment</TabsTrigger>
          <TabsTrigger value="assetLocation" className="shrink-0">Location</TabsTrigger>
          <TabsTrigger value="hardware" className="shrink-0">Hardware</TabsTrigger>
          <TabsTrigger value="software" className="shrink-0">OS &amp; software licenses</TabsTrigger>
          <TabsTrigger value="purchase" className="shrink-0">Purchase &amp; vendor</TabsTrigger>
          <TabsTrigger value="condition" className="shrink-0">Condition</TabsTrigger>
          {hasCustomFields && <TabsTrigger value="customFields" className="shrink-0">Custom fields</TabsTrigger>}
        </TabsList>

        <TabsContent value="basic">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {canEditAssetId && (
              <div className="flex flex-col gap-2">
                <Label htmlFor="asset-id">Asset ID</Label>
                <Input
                  id="asset-id"
                  value={form.assetId ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, assetId: e.target.value }))}
                  placeholder="Leave blank to auto-generate"
                />
              </div>
            )}
            <Field label="Asset name" id="asset-name" value={form.name} onChange={set("name")} />
            <Field label="Asset tag" id="asset-tag" value={form.assetTag} onChange={set("assetTag")} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="asset-category">Category</Label>
              <Select value={form.category} onValueChange={setSelect("category")}>
                <SelectTrigger id="asset-category" className="w-full">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name} ({c.prefix})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Device type" id="asset-device-type" value={form.deviceType} onChange={set("deviceType")} />
            <Field label="Asset type" id="asset-type" value={form.assetType} onChange={set("assetType")} />
            <Field label="Asset sub-type" id="asset-sub-type" value={form.assetSubType} onChange={set("assetSubType")} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="asset-ownership-type">Ownership type</Label>
              <Select value={form.ownershipType} onValueChange={setSelect("ownershipType")}>
                <SelectTrigger id="asset-ownership-type" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_OWNERSHIP_TYPES.map((o) => (
                    <SelectItem key={o} value={o}>
                      {o}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="asset-criticality">Criticality</Label>
              <Select value={form.criticality} onValueChange={setSelect("criticality")}>
                <SelectTrigger id="asset-criticality" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_CRITICALITY_LEVELS.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Company entity" id="asset-company-entity" value={form.companyEntity} onChange={set("companyEntity")} />
            <Field label="Description" id="asset-description" value={form.description} onChange={set("description")} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="asset-status">Status</Label>
              <Select value={form.status} onValueChange={setSelect("status")}>
                <SelectTrigger id="asset-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Color" id="asset-color" value={form.color} onChange={set("color")} />
          </div>
        </TabsContent>

        <TabsContent value="assignment">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="col-span-2 flex flex-col gap-2">
              <Label htmlFor="asset-assigned-user">Assigned to (system user)</Label>
              <Select value={form.assignedUser || NONE} onValueChange={(v) => setSelect("assignedUser")(v === NONE ? "" : v)}>
                <SelectTrigger id="asset-assigned-user" className="w-full">
                  <SelectValue placeholder="Unassigned" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Unassigned</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u._id} value={u._id}>
                      {u.name} ({u.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Employee ID, name, email and designation are shown from the selected user&apos;s
                profile - they are no longer entered separately here.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="asset-department">Department</Label>
              <Select value={form.department} onValueChange={setSelect("department")}>
                <SelectTrigger id="asset-department" className="w-full">
                  <SelectValue placeholder="Select a department" />
                </SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d._id} value={d._id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="asset-assignment-status">Assignment status</Label>
              <Select value={form.assignmentStatus} onValueChange={setSelect("assignmentStatus")}>
                <SelectTrigger id="asset-assignment-status" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_ASSIGNMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Assignment date" id="asset-assignment-date" type="date" value={form.assignmentDate} onChange={set("assignmentDate")} />
            <Field label="Return date" id="asset-return-date" type="date" value={form.returnDate} onChange={set("returnDate")} />
          </div>
        </TabsContent>

        <TabsContent value="assetLocation">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="asset-location">Location</Label>
              <Select value={form.location} onValueChange={setSelect("location")}>
                <SelectTrigger id="asset-location" className="w-full">
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {locations.map((l) => (
                    <SelectItem key={l._id} value={l._id}>
                      {l.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Sub-location" id="asset-sub-location" value={form.subLocation} onChange={set("subLocation")} />
            <Field label="Building" id="asset-building" value={form.building} onChange={set("building")} />
            <Field label="Floor" id="asset-floor" value={form.floor} onChange={set("floor")} />
            <Field label="Room" id="asset-room" value={form.room} onChange={set("room")} />
          </div>
        </TabsContent>

        <TabsContent value="hardware">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Manufacturer" id="asset-manufacturer" value={form.manufacturer} onChange={set("manufacturer")} />
            <Field label="Model" id="asset-model" value={form.model} onChange={set("model")} />
            <Field label="Serial number" id="asset-serial" value={form.serialNumber} onChange={set("serialNumber")} />
            <Field label="Service tag" id="asset-service-tag" value={form.serviceTag} onChange={set("serviceTag")} />
            <Field label="IMEI" id="asset-imei" value={form.imei} onChange={set("imei")} />
            <Field label="Processor" id="asset-processor" value={form.processor} onChange={set("processor")} />
            <Field label="Laptop generation" id="asset-laptop-generation" value={form.laptopGeneration} onChange={set("laptopGeneration")} />
            <Field label="Graphics card" id="asset-graphics-card" value={form.graphicsCard} onChange={set("graphicsCard")} />
            <Field label="RAM" id="asset-ram" value={form.ram} onChange={set("ram")} />
            <Field label="Storage" id="asset-storage" value={form.storage} onChange={set("storage")} />
            <Field label="Hostname" id="asset-hostname" value={form.hostname} onChange={set("hostname")} />
            <Field label="IP address" id="asset-ip" value={form.ipAddress} onChange={set("ipAddress")} />
            <Field label="MAC address" id="asset-mac" value={form.macAddress} onChange={set("macAddress")} />
            <Field label="Adapter serial number" id="asset-adapter-serial" value={form.adapterSerialNumber} onChange={set("adapterSerialNumber")} />
            <div className="col-span-2">
              <Field label="Miscellaneous accessories" id="asset-misc-accessories" value={form.miscAccessories} onChange={set("miscAccessories")} />
            </div>
            <div className="col-span-2">
              <Field label="Configuration" id="asset-configuration" value={form.configuration} onChange={set("configuration")} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="software">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Operating system" id="asset-os" value={form.operatingSystem} onChange={set("operatingSystem")} />
            <Field label="OS license" id="asset-os-license" value={form.operatingSystemLicense} onChange={set("operatingSystemLicense")} />
            <Field label="AD member" id="asset-ad-member" value={form.adMember} onChange={set("adMember")} />
            <Field label="Antivirus installed" id="asset-antivirus" value={form.antivirusInstalled} onChange={set("antivirusInstalled")} />
            <Field label="Remote software" id="asset-remote-software" value={form.remoteSoftware} onChange={set("remoteSoftware")} />
            <Field label="Email license" id="asset-email-license" value={form.emailLicense} onChange={set("emailLicense")} />
            <Field label="Canva license" id="asset-canva" value={form.canvaLicense} onChange={set("canvaLicense")} />
            <Field label="Microsoft Office" id="asset-ms-office" value={form.microsoftOffice} onChange={set("microsoftOffice")} />
            <Field label="Microsoft Project" id="asset-ms-project" value={form.microsoftProject} onChange={set("microsoftProject")} />
            <Field label="Power BI" id="asset-power-bi" value={form.powerBi} onChange={set("powerBi")} />
            <Field label="AutoCAD" id="asset-autocad" value={form.autoCad} onChange={set("autoCad")} />
            <Field label="ZWCAD" id="asset-zwcad" value={form.zwCad} onChange={set("zwCad")} />
            <Field label="Photoshop" id="asset-photoshop" value={form.photoshop} onChange={set("photoshop")} />
            <Field label="Creative Cloud Pro" id="asset-cc-pro" value={form.creativeCloudPro} onChange={set("creativeCloudPro")} />
            <Field label="Illustrator" id="asset-illustrator" value={form.illustrator} onChange={set("illustrator")} />
            <Field label="Acrobat Pro" id="asset-acrobat" value={form.acrobatPro} onChange={set("acrobatPro")} />
            <Field label="SketchUp Pro" id="asset-sketchup" value={form.sketchUpPro} onChange={set("sketchUpPro")} />
            <Field label="RocketReach Pro" id="asset-rocketreach" value={form.rocketReachPro} onChange={set("rocketReachPro")} />
            <Field label="D5 Render" id="asset-d5-render" value={form.d5Render} onChange={set("d5Render")} />
            <Field label="Zoom license" id="asset-zoom" value={form.zoomLicense} onChange={set("zoomLicense")} />
            <Field label="Shared folder access" id="asset-shared-folder" value={form.sharedFolderAccess} onChange={set("sharedFolderAccess")} />
          </div>
        </TabsContent>

        <TabsContent value="purchase">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Purchase date" id="asset-purchase-date" type="date" value={form.purchaseDate} onChange={set("purchaseDate")} />
            <Field label="Purchase cost" id="asset-purchase-cost" type="number" value={form.purchaseCost} onChange={set("purchaseCost")} />
            <Field label="Quantity" id="asset-quantity" type="number" value={form.quantity} onChange={set("quantity")} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="asset-vendor">Vendor</Label>
              <Select value={form.vendor} onValueChange={setSelect("vendor")}>
                <SelectTrigger id="asset-vendor" className="w-full">
                  <SelectValue placeholder="Select a vendor" />
                </SelectTrigger>
                <SelectContent>
                  {vendors.map((v) => (
                    <SelectItem key={v._id} value={v._id}>
                      {v.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Purchase order number" id="asset-po" value={form.purchaseOrderNumber} onChange={set("purchaseOrderNumber")} />
            <Field label="Invoice number" id="asset-invoice" value={form.invoiceNumber} onChange={set("invoiceNumber")} />
            <Field label="Currency" id="asset-currency" value={form.currency} onChange={set("currency")} />
            <Field label="Cost center" id="asset-cost-center" value={form.costCenter} onChange={set("costCenter")} />
            <Field label="Budget code" id="asset-budget-code" value={form.budgetCode} onChange={set("budgetCode")} />
            <div className="flex flex-col gap-2">
              <Label htmlFor="asset-depreciation-method">Depreciation method</Label>
              <Select value={form.depreciationMethod} onValueChange={setSelect("depreciationMethod")}>
                <SelectTrigger id="asset-depreciation-method" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASSET_DEPRECIATION_METHODS.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Field label="Depreciation start date" id="asset-depreciation-start" type="date" value={form.depreciationStartDate} onChange={set("depreciationStartDate")} />
            <Field label="Contract number" id="asset-contract-number" value={form.contractNumber} onChange={set("contractNumber")} />
            <Field label="Warranty start" id="asset-warranty-start" type="date" value={form.warrantyStartDate} onChange={set("warrantyStartDate")} />
            <Field label="Warranty end" id="asset-warranty-end" type="date" value={form.warrantyEndDate} onChange={set("warrantyEndDate")} />
            <Field label="Warranty provider" id="asset-warranty-provider" value={form.warrantyProvider} onChange={set("warrantyProvider")} />
            <Field label="Support contract" id="asset-support-contract" value={form.supportContract} onChange={set("supportContract")} />
            <Field label="Contract start" id="asset-contract-start" type="date" value={form.contractStartDate} onChange={set("contractStartDate")} />
            <Field label="Contract end" id="asset-contract-end" type="date" value={form.contractEndDate} onChange={set("contractEndDate")} />
          </div>
        </TabsContent>

        <TabsContent value="condition">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Condition" id="asset-condition" value={form.condition} onChange={set("condition")} />
            <div className="col-span-2">
              <Field label="Repair history" id="asset-repair-history" value={form.repairHistory} onChange={set("repairHistory")} />
            </div>
          </div>
        </TabsContent>

        {hasCustomFields && (
          <TabsContent value="customFields">
            <CustomFieldsSection
              module="assets"
              value={form.customFields}
              onChange={(customFields) => setForm((f) => ({ ...f, customFields }))}
            />
          </TabsContent>
        )}
      </Tabs>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : isEdit ? "Save changes" : "Create asset"}
        </Button>
      </div>
    </form>
  )
}
