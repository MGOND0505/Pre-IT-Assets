"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { ENTITLEMENT_MODULES, MODULE_LABELS, type EntitlementModule } from "@/lib/permissions"

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

type CreatedOrganization = { slug: string }

export function CreateOrganizationDialog({ onCreated }: { onCreated: (slug: string) => void }) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [slug, setSlug] = React.useState("")
  const [slugTouched, setSlugTouched] = React.useState(false)
  const [code, setCode] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [address, setAddress] = React.useState("")
  const [adminName, setAdminName] = React.useState("")
  const [adminEmail, setAdminEmail] = React.useState("")
  const [adminPassword, setAdminPassword] = React.useState("")
  const [enabledModules, setEnabledModules] = React.useState<EntitlementModule[]>([...ENTITLEMENT_MODULES])
  const [validFrom, setValidFrom] = React.useState("")
  const [validUntil, setValidUntil] = React.useState("")
  const [recycleBinRetentionDays, setRecycleBinRetentionDays] = React.useState("30")
  const [submitting, setSubmitting] = React.useState(false)

  function toggleModule(moduleKey: EntitlementModule) {
    setEnabledModules((prev) =>
      prev.includes(moduleKey) ? prev.filter((m) => m !== moduleKey) : [...prev, moduleKey]
    )
  }

  function resetForm() {
    setName("")
    setSlug("")
    setSlugTouched(false)
    setCode("")
    setEmail("")
    setPhone("")
    setAddress("")
    setAdminName("")
    setAdminEmail("")
    setAdminPassword("")
    setEnabledModules([...ENTITLEMENT_MODULES])
    setValidFrom("")
    setValidUntil("")
    setRecycleBinRetentionDays("30")
  }

  function handleNameChange(value: string) {
    setName(value)
    if (!slugTouched) setSlug(slugify(value))
  }

  const webLink = slug && typeof window !== "undefined" ? `${window.location.origin}/${slug}` : ""

  async function handleSave() {
    if (!name.trim() || !slug.trim()) {
      toast.error("Organization name and slug are required")
      return
    }
    if (!adminName.trim() || !adminEmail.trim() || adminPassword.length < 8) {
      toast.error("Admin name, email, and an 8+ character password are required")
      return
    }
    setSubmitting(true)
    try {
      const res = await apiClient.post<ApiEnvelope<CreatedOrganization>>("/organizations", {
        name,
        slug,
        code: code || undefined,
        email,
        phone,
        addressLine1: address,
        adminName,
        adminEmail,
        adminPassword,
        enabledModules,
        validFrom: validFrom || undefined,
        validUntil: validUntil || undefined,
        recycleBinRetentionDays: recycleBinRetentionDays ? Number(recycleBinRetentionDays) : undefined,
      })
      toast.success("Organization created")
      setOpen(false)
      resetForm()
      onCreated(res.data.data.slug)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not create organization"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create Organization</Button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create organization</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-create-name">Organization name</Label>
            <Input id="org-create-name" value={name} onChange={(e) => handleNameChange(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-create-slug">Web link slug</Label>
            <Input
              id="org-create-slug"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(slugify(e.target.value))
              }}
            />
            {webLink && <p className="text-xs text-muted-foreground">{webLink}</p>}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-create-code">Organization code</Label>
            <Input id="org-create-code" value={code} onChange={(e) => setCode(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-create-email">Organization email</Label>
            <Input id="org-create-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-create-phone">Contact number</Label>
            <Input id="org-create-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="org-create-address">Address</Label>
            <Textarea id="org-create-address" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>

          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium">Validity period</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="org-create-valid-from">Valid from</Label>
                <Input id="org-create-valid-from" type="date" value={validFrom} onChange={(e) => setValidFrom(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="org-create-valid-until">Valid until</Label>
                <Input id="org-create-valid-until" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
              </div>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">Leave blank for an organization with no expiry.</p>
          </div>

          <div className="border-t pt-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="org-create-retention">Recycle Bin retention (days)</Label>
              <Input
                id="org-create-retention"
                type="number"
                min={30}
                max={180}
                value={recycleBinRetentionDays}
                onChange={(e) => setRecycleBinRetentionDays(e.target.value)}
                className="max-w-32"
              />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              How long deleted data inside this organization stays restorable before it&apos;s permanently removed. 30-180 days.
            </p>
          </div>

          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium">Enabled modules</p>
            <div className="grid grid-cols-2 gap-2">
              {ENTITLEMENT_MODULES.map((moduleKey) => (
                <label key={moduleKey} className="flex items-center gap-2 text-sm">
                  <Checkbox checked={enabledModules.includes(moduleKey)} onCheckedChange={() => toggleModule(moduleKey)} />
                  {MODULE_LABELS[moduleKey]}
                </label>
              ))}
            </div>
          </div>

          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium">Organization Admin</p>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="org-create-admin-name">Admin name</Label>
                <Input id="org-create-admin-name" value={adminName} onChange={(e) => setAdminName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="org-create-admin-email">Admin email</Label>
                <Input
                  id="org-create-admin-email"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="org-create-admin-password">Admin password</Label>
                <Input
                  id="org-create-admin-password"
                  type="password"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Creating..." : "Create organization"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
