"use client"

import { useRouter } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DesignationForm, EMPTY_DESIGNATION_FORM } from "@/components/designations/designation-form"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

export default function AddDesignationPage() {
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()

  const canCreate = can(user, "designations", "create")

  if (authLoading) return null
  if (!canCreate) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Designation</h1>
        <p className="text-sm text-muted-foreground">Register a new job designation used across the system.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New designation</CardTitle>
        </CardHeader>
        <CardContent>
          <DesignationForm
            initial={EMPTY_DESIGNATION_FORM}
            onSaved={() => router.push(toOrgHref("/designations"))}
            onCancel={() => router.push(toOrgHref("/designations"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
