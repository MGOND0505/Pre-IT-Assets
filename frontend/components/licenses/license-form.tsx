"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { CustomFieldsSection } from "@/components/custom-fields/custom-fields-section"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { shouldWarnBeforeChange } from "@/lib/permissions"
import {
  useCustomFieldDefinitionOptions,
  useDepartmentOptions,
  useLicenseCategoryOptions,
  useUserOptions,
  useVendorOptions,
} from "@/lib/use-lookup-options"
import { LICENSE_STATUSES } from "@/components/licenses/license-status-badge"

const LICENSE_TYPES = ["Subscription", "Per User", "Per Device", "Perpetual", "Volume License", "Trial"] as const

export type LicenseFormValues = {
  _id?: string
  softwareName: string
  productName: string
  publisher: string
  category: string
  licenseType: string
  vendor: string
  purchaseDate: string
  startDate: string
  expiryDate: string
  renewalDate: string
  totalLicenses: string
  assignedUsers: string[]
  department: string
  status: string
  notes: string
  customFields: Record<string, unknown>
}

export const EMPTY_LICENSE_FORM: LicenseFormValues = {
  softwareName: "",
  productName: "",
  publisher: "",
  category: "",
  licenseType: "Subscription",
  vendor: "",
  purchaseDate: "",
  startDate: "",
  expiryDate: "",
  renewalDate: "",
  totalLicenses: "1",
  assignedUsers: [],
  department: "",
  status: "Active",
  notes: "",
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

export function LicenseForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: LicenseFormValues
  onSaved: (licenseId: string) => void
  onCancel?: () => void
}) {
  const [form, setForm] = React.useState<LicenseFormValues>(initial)
  const [submitting, setSubmitting] = React.useState(false)
  const [confirmOpen, setConfirmOpen] = React.useState(false)

  const { user } = useAuth()
  const { items: categories } = useLicenseCategoryOptions()
  const { items: vendors } = useVendorOptions()
  const { items: departments } = useDepartmentOptions()
  const { items: users } = useUserOptions()
  // Tagging a license to employee(s) is Org Admin/Super Admin only - mirrors asset-form.tsx's own
  // canAssignEmployee. Backend re-enforces this regardless
  // (licenses.controller.ts#stripAssignedUsersUnlessAdmin).
  const canAssignEmployee = Boolean(user?.isAdmin)
  // Gates the "Custom fields" section's very existence, not just its contents - a form with none
  // configured must look exactly like it did before this feature existed.
  const { items: customFieldDefinitions } = useCustomFieldDefinitionOptions("licenses")
  const hasCustomFields = customFieldDefinitions.length > 0

  function set<K extends keyof LicenseFormValues>(field: K) {
    return (value: LicenseFormValues[K]) => setForm((f) => ({ ...f, [field]: value }))
  }

  function setSelect<K extends keyof LicenseFormValues>(field: K) {
    return (value: string | null) => setForm((f) => ({ ...f, [field]: value ?? "" }))
  }

  function toggleAssignedUser(userId: string) {
    setForm((f) => ({
      ...f,
      assignedUsers: f.assignedUsers.includes(userId)
        ? f.assignedUsers.filter((id) => id !== userId)
        : [...f.assignedUsers, userId],
    }))
  }

  const isEdit = Boolean(form._id)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.softwareName.trim()) {
      toast.error("Software name is required")
      return
    }
    if (form.assignedUsers.length > Number(form.totalLicenses || 1)) {
      toast.error("Cannot assign more users than the total license seats")
      return
    }

    if (isEdit && shouldWarnBeforeChange(user)) {
      setConfirmOpen(true)
      return
    }

    performSave()
  }

  async function performSave() {
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        category: form.category || undefined,
        vendor: form.vendor || undefined,
        department: form.department || undefined,
        purchaseDate: form.purchaseDate || undefined,
        startDate: form.startDate || undefined,
        expiryDate: form.expiryDate || undefined,
        renewalDate: form.renewalDate || undefined,
        totalLicenses: form.totalLicenses ? Number(form.totalLicenses) : undefined,
      }

      if (isEdit && form._id) {
        const res = await apiClient.put(`/licenses/${form._id}`, payload)
        toast.success("License updated")
        onSaved(res.data.data._id)
      } else {
        const res = await apiClient.post("/licenses", payload)
        toast.success(`License created: ${res.data.data.licenseId}`)
        onSaved(res.data.data._id)
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save license"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Basic information</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Software name" id="lic-software-name" value={form.softwareName} onChange={set("softwareName")} />
          <Field label="Product name" id="lic-product-name" value={form.productName} onChange={set("productName")} />
          <Field label="Publisher" id="lic-publisher" value={form.publisher} onChange={set("publisher")} />
          <div className="flex flex-col gap-2">
            <Label htmlFor="lic-category">Category</Label>
            <Select value={form.category} onValueChange={setSelect("category")}>
              <SelectTrigger id="lic-category" className="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lic-type">License type</Label>
            <Select value={form.licenseType} onValueChange={setSelect("licenseType")}>
              <SelectTrigger id="lic-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LICENSE_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lic-status">Status</Label>
            <Select value={form.status} onValueChange={setSelect("status")}>
              <SelectTrigger id="lic-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LICENSE_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="lic-vendor">Vendor</Label>
            <Select value={form.vendor} onValueChange={setSelect("vendor")}>
              <SelectTrigger id="lic-vendor" className="w-full">
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
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Dates &amp; quantity</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Purchase date" id="lic-purchase-date" type="date" value={form.purchaseDate} onChange={set("purchaseDate")} />
          <Field label="Start date" id="lic-start-date" type="date" value={form.startDate} onChange={set("startDate")} />
          <Field label="Expiry date" id="lic-expiry-date" type="date" value={form.expiryDate} onChange={set("expiryDate")} />
          <Field label="Renewal date" id="lic-renewal-date" type="date" value={form.renewalDate} onChange={set("renewalDate")} />
          <Field label="Total licenses" id="lic-total" type="number" value={form.totalLicenses} onChange={set("totalLicenses")} />
        </div>
      </section>

      <Separator />

      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Department &amp; assigned users</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="lic-department">Department</Label>
            <Select value={form.department} onValueChange={setSelect("department")}>
              <SelectTrigger id="lic-department" className="w-full">
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
        </div>
        <div className="flex flex-col gap-2">
          <Label>
            Assigned users ({form.assignedUsers.length}/{form.totalLicenses || 1})
          </Label>
          {canAssignEmployee ? (
            <div className="flex max-h-40 flex-col gap-1 overflow-y-auto rounded-md border p-2">
              {users.length === 0 && <p className="text-sm text-muted-foreground">No users found.</p>}
              {users.map((u) => (
                <label key={u._id} className="flex items-center gap-2 rounded px-2 py-1 text-sm hover:bg-muted">
                  <input
                    type="checkbox"
                    checked={form.assignedUsers.includes(u._id)}
                    onChange={() => toggleAssignedUser(u._id)}
                  />
                  {u.name} ({u.email})
                </label>
              ))}
            </div>
          ) : (
            <div className="rounded-md border bg-muted/50 p-2 text-sm text-muted-foreground">
              {form.assignedUsers.length === 0
                ? "Unassigned"
                : form.assignedUsers
                    .map((id) => users.find((u) => u._id === id)?.name ?? "Assigned")
                    .join(", ")}
              <span className="block text-xs">Only an Org Admin can tag this license to an employee.</span>
            </div>
          )}
        </div>
        <div className="col-span-2">
          <Field label="Notes" id="lic-notes" value={form.notes} onChange={set("notes")} />
        </div>
      </section>

      {hasCustomFields && (
        <>
          <Separator />
          <section className="flex flex-col gap-4">
            <h3 className="text-sm font-semibold text-muted-foreground">Custom fields</h3>
            <CustomFieldsSection
              module="licenses"
              value={form.customFields}
              onChange={(customFields) => setForm((f) => ({ ...f, customFields }))}
            />
          </section>
        </>
      )}

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : isEdit ? "Save changes" : "Create license"}
        </Button>
      </div>
    </form>
    <ConfirmDialog
      open={confirmOpen}
      onOpenChange={setConfirmOpen}
      title="Confirm license changes"
      description="You're about to update this license's existing information. Review your changes before saving."
      confirmLabel="Save changes"
      onConfirm={() => {
        setConfirmOpen(false)
        performSave()
      }}
    />
    </>
  )
}
