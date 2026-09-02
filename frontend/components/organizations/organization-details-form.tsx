"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { ENTITLEMENT_MODULES, MODULE_LABELS, type EntitlementModule } from "@/lib/permissions"

export type OrganizationDetails = {
  _id: string
  name: string
  code: string | null
  email: string
  phone: string
  addressLine1: string
  addressLine2: string
  city: string
  state: string
  country: string
  postalCode: string
  status: "Active" | "Inactive"
  enabledModules: EntitlementModule[]
  validFrom: string | null
  validUntil: string | null
  gracePeriodDays: number
  recycleBinRetentionDays: number
}

export type OrganizationDetailsFormValues = {
  name: string
  code: string
  email: string
  phone: string
  address: string
  enabledModules: EntitlementModule[]
  validFrom: string
  validUntil: string
  gracePeriodDays: string
  recycleBinRetentionDays: string
}

export function toOrganizationDetailsFormValues(org: OrganizationDetails): OrganizationDetailsFormValues {
  return {
    name: org.name,
    code: org.code ?? "",
    email: org.email,
    phone: org.phone,
    address: org.addressLine1,
    enabledModules: org.enabledModules,
    validFrom: org.validFrom?.slice(0, 10) ?? "",
    validUntil: org.validUntil?.slice(0, 10) ?? "",
    gracePeriodDays: String(org.gracePeriodDays),
    recycleBinRetentionDays: String(org.recycleBinRetentionDays),
  }
}

// Field-only, Dialog-agnostic - used by /organization/edit/page.tsx. Was previously a
// Dialog size="full" (EditOrganizationDialog, inline in organization/page.tsx) - converted to a
// real page to match every other module's Add/Edit, already standardized on full pages earlier
// this session (this one dialog was the one holdout, left out of that pass).
export function OrganizationDetailsForm({
  idOrSlug,
  initial,
  onSaved,
  onCancel,
}: {
  idOrSlug: string
  initial: OrganizationDetailsFormValues
  onSaved: () => void
  onCancel?: () => void
}) {
  const [form, setForm] = React.useState<OrganizationDetailsFormValues>(initial)
  const [submitting, setSubmitting] = React.useState(false)

  function toggleModule(moduleKey: EntitlementModule) {
    setForm((f) => ({
      ...f,
      enabledModules: f.enabledModules.includes(moduleKey)
        ? f.enabledModules.filter((m) => m !== moduleKey)
        : [...f.enabledModules, moduleKey],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }

    setSubmitting(true)
    try {
      await apiClient.put(`/organizations/${idOrSlug}`, {
        name: form.name,
        code: form.code || undefined,
        email: form.email,
        phone: form.phone,
        addressLine1: form.address,
        enabledModules: form.enabledModules,
        validFrom: form.validFrom || undefined,
        validUntil: form.validUntil || undefined,
        gracePeriodDays: form.gracePeriodDays ? Number(form.gracePeriodDays) : undefined,
        recycleBinRetentionDays: form.recycleBinRetentionDays ? Number(form.recycleBinRetentionDays) : undefined,
      })
      toast.success("Organization updated")
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update organization"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="org-name">Name</Label>
        <Input id="org-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="org-code">Code</Label>
        <Input id="org-code" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="org-email">Email</Label>
        <Input
          id="org-email"
          type="email"
          value={form.email}
          onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="org-phone">Phone</Label>
        <Input id="org-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="org-address">Address</Label>
        <Textarea
          id="org-address"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />
      </div>

      <div className="border-t pt-4">
        <p className="mb-3 text-sm font-medium">Validity period</p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-valid-from">Valid from</Label>
            <Input
              id="org-valid-from"
              type="date"
              value={form.validFrom}
              onChange={(e) => setForm((f) => ({ ...f, validFrom: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-valid-until">Valid until</Label>
            <Input
              id="org-valid-until"
              type="date"
              value={form.validUntil}
              onChange={(e) => setForm((f) => ({ ...f, validUntil: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-grace-days">Grace period (days)</Label>
            <Input
              id="org-grace-days"
              type="number"
              min={0}
              value={form.gracePeriodDays}
              onChange={(e) => setForm((f) => ({ ...f, gracePeriodDays: e.target.value }))}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-retention-days">Recycle Bin retention (days)</Label>
            <Input
              id="org-retention-days"
              type="number"
              min={30}
              max={180}
              value={form.recycleBinRetentionDays}
              onChange={(e) => setForm((f) => ({ ...f, recycleBinRetentionDays: e.target.value }))}
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Leave &quot;Valid until&quot; blank for no expiry. Recycle Bin retention applies to deleted data inside
          this organization (30-180 days).
        </p>
      </div>

      <div className="border-t pt-4">
        <p className="mb-3 text-sm font-medium">Enabled modules</p>
        <div className="grid grid-cols-2 gap-2">
          {ENTITLEMENT_MODULES.map((moduleKey) => (
            <label key={moduleKey} className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.enabledModules.includes(moduleKey)} onCheckedChange={() => toggleModule(moduleKey)} />
              {MODULE_LABELS[moduleKey]}
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </form>
  )
}
