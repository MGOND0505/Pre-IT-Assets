"use client"

import { useRouter } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { VendorForm, EMPTY_VENDOR_FORM } from "@/components/vendors/vendor-form"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

export default function AddVendorPage() {
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()

  const canCreate = can(user, "vendors", "create")

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
          <VendorForm
            initial={EMPTY_VENDOR_FORM}
            onSaved={() => router.push(toOrgHref("/vendors"))}
            onCancel={() => router.push(toOrgHref("/vendors"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
