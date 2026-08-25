"use client"

import { useRouter } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LicenseForm, EMPTY_LICENSE_FORM } from "@/components/licenses/license-form"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

export default function AddLicensePage() {
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()

  const canCreate = can(user, "licenses", "create")

  if (authLoading) return null
  if (!canCreate) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add License</h1>
        <p className="text-sm text-muted-foreground">The License ID is generated automatically.</p>
      </div>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>New license</CardTitle>
        </CardHeader>
        <CardContent>
          <LicenseForm
            initial={EMPTY_LICENSE_FORM}
            onSaved={(id) => router.push(toOrgHref(`/licenses/${id}`))}
            onCancel={() => router.push(toOrgHref("/licenses"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
