"use client"

import { useRouter } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LicenseCategoryForm, EMPTY_LICENSE_CATEGORY_FORM } from "@/components/license-categories/license-category-form"
import { useAuth } from "@/lib/auth-context"
import { useOrgHref } from "@/lib/use-org-href"

export default function AddLicenseCategoryPage() {
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()

  const canCreate = Boolean(user?.isAdmin)

  if (authLoading) return null
  if (!canCreate) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add License Category</h1>
        <p className="text-sm text-muted-foreground">Organize licenses into categories.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New license category</CardTitle>
        </CardHeader>
        <CardContent>
          <LicenseCategoryForm
            initial={EMPTY_LICENSE_CATEGORY_FORM}
            onSaved={() => router.push(toOrgHref("/licenses/categories"))}
            onCancel={() => router.push(toOrgHref("/licenses/categories"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
