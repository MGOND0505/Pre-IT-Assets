"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import {
  useAssetCategoryOptions,
  useDepartmentOptions,
  useLocationOptions,
  useUserOptions,
  useVendorOptions,
} from "@/lib/use-lookup-options"
import { ASSET_STATUSES } from "@/components/assets/asset-status-badge"

const NONE = "__none__"

export type AssetFormValues = {
  _id?: string
  assetId?: string
  name: string
  category: string
  assetType: string
  deviceType: string
  status: string
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
  purchaseDate: string
  purchaseCost: string
  quantity: string
  vendor: string
  companyName: string
  poNumber: string
  invoiceNumber: string
  warrantyStart: string
  warrantyEnd: string
  amcStart: string
  amcEnd: string
  location: string
  subLocation: string
  department: string
  assignedUser: string
  userAccessLevel: string
  employeeId: string
  employeeName: string
  designation: string
  email: string
  currentOwner: string
  previousOwner: string
  notes: string
}

export const EMPTY_ASSET_FORM: AssetFormValues = {
  assetId: "",
  name: "",
  category: "",
  assetType: "",
  deviceType: "",
  status: "In Stock",
  condition: "",
  conditionNotes: "",
  approvalStatus: "",
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
  companyName: "",
  poNumber: "",
  invoiceNumber: "",
  warrantyStart: "",
  warrantyEnd: "",
  amcStart: "",
  amcEnd: "",
  location: "",
  subLocation: "",
  department: "",
  assignedUser: "",
  userAccessLevel: "",
  employeeId: "",
  employeeName: "",
  designation: "",
  email: "",
  currentOwner: "",
  previousOwner: "",
  notes: "",
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
        warrantyStart: form.warrantyStart || undefined,
        warrantyEnd: form.warrantyEnd || undefined,
        amcStart: form.amcStart || undefined,
        amcEnd: form.amcEnd || undefined,
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
          <TabsTrigger value="assignment" className="shrink-0">Employee &amp; assignment</TabsTrigger>
          <TabsTrigger value="hardware" className="shrink-0">Hardware</TabsTrigger>
          <TabsTrigger value="software" className="shrink-0">OS &amp; software licenses</TabsTrigger>
          <TabsTrigger value="purchase" className="shrink-0">Purchase &amp; vendor</TabsTrigger>
          <TabsTrigger value="condition" className="shrink-0">Condition &amp; notes</TabsTrigger>
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
            <Field label="Designation" id="asset-designation" value={form.designation} onChange={set("designation")} />
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
            </div>
            <Field label="Employee ID" id="asset-employee-id" value={form.employeeId} onChange={set("employeeId")} />
            <Field label="Employee name" id="asset-employee-name" value={form.employeeName} onChange={set("employeeName")} />
            <Field label="Email ID" id="asset-email" value={form.email} onChange={set("email")} />
            <Field label="User access" id="asset-user-access" value={form.userAccessLevel} onChange={set("userAccessLevel")} />
            <Field label="Current owner" id="asset-current-owner" value={form.currentOwner} onChange={set("currentOwner")} />
            <Field label="Previous owner" id="asset-previous-owner" value={form.previousOwner} onChange={set("previousOwner")} />
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
            <Field label="Company name" id="asset-company-name" value={form.companyName} onChange={set("companyName")} />
            <Field label="PO number" id="asset-po" value={form.poNumber} onChange={set("poNumber")} />
            <Field label="Invoice number" id="asset-invoice" value={form.invoiceNumber} onChange={set("invoiceNumber")} />
            <Field label="Warranty start" id="asset-warranty-start" type="date" value={form.warrantyStart} onChange={set("warrantyStart")} />
            <Field label="Warranty end" id="asset-warranty-end" type="date" value={form.warrantyEnd} onChange={set("warrantyEnd")} />
            <Field label="AMC start" id="asset-amc-start" type="date" value={form.amcStart} onChange={set("amcStart")} />
            <Field label="AMC end" id="asset-amc-end" type="date" value={form.amcEnd} onChange={set("amcEnd")} />
          </div>
        </TabsContent>

        <TabsContent value="condition">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Condition" id="asset-condition" value={form.condition} onChange={set("condition")} />
            <Field label="Approval status" id="asset-approval-status" value={form.approvalStatus} onChange={set("approvalStatus")} />
            <div className="col-span-2">
              <Field label="Condition notes" id="asset-condition-notes" value={form.conditionNotes} onChange={set("conditionNotes")} />
            </div>
            <div className="col-span-2">
              <Field label="Repair history" id="asset-repair-history" value={form.repairHistory} onChange={set("repairHistory")} />
            </div>
            <div className="col-span-2">
              <Field label="Notes" id="asset-notes" value={form.notes} onChange={set("notes")} />
            </div>
          </div>
        </TabsContent>
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
