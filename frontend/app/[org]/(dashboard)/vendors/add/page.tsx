"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

const EMPTY_FORM = {
  name: "",
  contactPerson: "",
  email: "",
  phone: "",
  service: "",
  address: "",
  contractStart: "",
  contractEnd: "",
  notes: "",
}

export default function AddVendorPage() {
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [form, setForm] = React.useState(EMPTY_FORM)
  const [submitting, setSubmitting] = React.useState(false)

  const canCreate = can(user, "vendors", "create")

  function set(field: keyof typeof EMPTY_FORM) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }))
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error("Vendor name is required")
      return
    }
    setSubmitting(true)
    try {
      await apiClient.post("/vendors", {
        ...form,
        contractStart: form.contractStart || undefined,
        contractEnd: form.contractEnd || undefined,
      })
      toast.success("Vendor created")
      router.push(toOrgHref("/vendors"))
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not create vendor"))
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) return null
  if (!canCreate) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Vendor</h1>
        <p className="text-sm text-muted-foreground">Register a new vendor used across assets and licenses.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>New vendor</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="col-span-2 flex flex-col gap-2">
              <Label htmlFor="vendor-name">Vendor name</Label>
              <Input id="vendor-name" value={form.name} onChange={set("name")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="vendor-contact">Contact person</Label>
              <Input id="vendor-contact" value={form.contactPerson} onChange={set("contactPerson")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="vendor-service">Service</Label>
              <Input id="vendor-service" value={form.service} onChange={set("service")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="vendor-email">Email</Label>
              <Input id="vendor-email" type="email" value={form.email} onChange={set("email")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="vendor-phone">Phone</Label>
              <Input id="vendor-phone" value={form.phone} onChange={set("phone")} />
            </div>
            <div className="col-span-2 flex flex-col gap-2">
              <Label htmlFor="vendor-address">Address</Label>
              <Input id="vendor-address" value={form.address} onChange={set("address")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="vendor-contract-start">Contract start</Label>
              <Input id="vendor-contract-start" type="date" value={form.contractStart} onChange={set("contractStart")} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="vendor-contract-end">Contract end</Label>
              <Input id="vendor-contract-end" type="date" value={form.contractEnd} onChange={set("contractEnd")} />
            </div>
            <div className="col-span-2 flex flex-col gap-2">
              <Label htmlFor="vendor-notes">Notes</Label>
              <Input id="vendor-notes" value={form.notes} onChange={set("notes")} />
            </div>
          </div>
        </CardContent>
        <CardFooter className="gap-2">
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Creating..." : "Create vendor"}
          </Button>
          <Button variant="outline" onClick={() => router.push(toOrgHref("/vendors"))}>
            Cancel
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
