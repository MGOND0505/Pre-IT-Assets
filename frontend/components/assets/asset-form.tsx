"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
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
  name: string
  category: string
  assetType: string
  status: string
  condition: string
  manufacturer: string
  model: string
  serialNumber: string
  serviceTag: string
  imei: string
  hostname: string
  ipAddress: string
  macAddress: string
  operatingSystem: string
  configuration: string
  purchaseDate: string
  purchaseCost: string
  vendor: string
  poNumber: string
  invoiceNumber: string
  warrantyStart: string
  warrantyEnd: string
  amcStart: string
  amcEnd: string
  location: string
  department: string
  assignedUser: string
  notes: string
}

export const EMPTY_ASSET_FORM: AssetFormValues = {
  name: "",
  category: "",
  assetType: "",
  status: "In Stock",
  condition: "",
  manufacturer: "",
  model: "",
  serialNumber: "",
  serviceTag: "",
  imei: "",
  hostname: "",
  ipAddress: "",
  macAddress: "",
  operatingSystem: "",
  configuration: "",
  purchaseDate: "",
  purchaseCost: "",
  vendor: "",
  poNumber: "",
  invoiceNumber: "",
  warrantyStart: "",
  warrantyEnd: "",
  amcStart: "",
  amcEnd: "",
  location: "",
  department: "",
  assignedUser: "",
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
        purchaseCost: form.purchaseCost ? Number(form.purchaseCost) : undefined,
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
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Basic information</h3>
        <div className="grid grid-cols-2 gap-4">
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
          <Field label="Condition" id="asset-condition" value={form.condition} onChange={set("condition")} />
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Specifications</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Manufacturer" id="asset-manufacturer" value={form.manufacturer} onChange={set("manufacturer")} />
          <Field label="Model" id="asset-model" value={form.model} onChange={set("model")} />
          <Field label="Serial number" id="asset-serial" value={form.serialNumber} onChange={set("serialNumber")} />
          <Field label="Service tag" id="asset-service-tag" value={form.serviceTag} onChange={set("serviceTag")} />
          <Field label="IMEI" id="asset-imei" value={form.imei} onChange={set("imei")} />
          <Field label="Hostname" id="asset-hostname" value={form.hostname} onChange={set("hostname")} />
          <Field label="IP address" id="asset-ip" value={form.ipAddress} onChange={set("ipAddress")} />
          <Field label="MAC address" id="asset-mac" value={form.macAddress} onChange={set("macAddress")} />
          <Field label="Operating system" id="asset-os" value={form.operatingSystem} onChange={set("operatingSystem")} />
          <div className="col-span-2">
            <Field
              label="Configuration"
              id="asset-configuration"
              value={form.configuration}
              onChange={set("configuration")}
            />
          </div>
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Financial &amp; warranty</h3>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Purchase date" id="asset-purchase-date" type="date" value={form.purchaseDate} onChange={set("purchaseDate")} />
          <Field label="Purchase cost" id="asset-purchase-cost" type="number" value={form.purchaseCost} onChange={set("purchaseCost")} />
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
          <Field label="PO number" id="asset-po" value={form.poNumber} onChange={set("poNumber")} />
          <Field label="Invoice number" id="asset-invoice" value={form.invoiceNumber} onChange={set("invoiceNumber")} />
          <Field label="Warranty start" id="asset-warranty-start" type="date" value={form.warrantyStart} onChange={set("warrantyStart")} />
          <Field label="Warranty end" id="asset-warranty-end" type="date" value={form.warrantyEnd} onChange={set("warrantyEnd")} />
          <Field label="AMC start" id="asset-amc-start" type="date" value={form.amcStart} onChange={set("amcStart")} />
          <Field label="AMC end" id="asset-amc-end" type="date" value={form.amcEnd} onChange={set("amcEnd")} />
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Location &amp; assignment</h3>
        <div className="grid grid-cols-2 gap-4">
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
          <div className="col-span-2 flex flex-col gap-2">
            <Label htmlFor="asset-assigned-user">Assigned to</Label>
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
          <div className="col-span-2">
            <Field label="Notes" id="asset-notes" value={form.notes} onChange={set("notes")} />
          </div>
        </div>
      </section>

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
