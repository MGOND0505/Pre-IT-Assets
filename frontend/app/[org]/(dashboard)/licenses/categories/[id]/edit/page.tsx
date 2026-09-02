"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { LicenseCategoryForm, type LicenseCategoryFormValues } from "@/components/license-categories/license-category-form"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { useOrgHref } from "@/lib/use-org-href"

type LicenseCategory = { _id: string; name: string; description: string; status: "Active" | "Inactive" }

function toFormValues(category: LicenseCategory): LicenseCategoryFormValues {
  return { _id: category._id, name: category.name, description: category.description }
}

export default function EditLicenseCategoryPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [category, setCategory] = React.useState<LicenseCategory | null>(null)
  const [loading, setLoading] = React.useState(true)

  const canWrite = Boolean(user?.isAdmin)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<LicenseCategory>>(`/license-categories/${params.id}`)
      setCategory(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load license category"))
    } finally {
      setLoading(false)
    }
  }, [params.id])

  React.useEffect(() => {
    if (canWrite) load()
  }, [canWrite, load])

  if (authLoading || loading) return null
  if (!canWrite) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }
  if (!category) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit License Category</h1>
        <p className="text-sm text-muted-foreground">{category.name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>License category details</CardTitle>
        </CardHeader>
        <CardContent>
          <LicenseCategoryForm
            initial={toFormValues(category)}
            onSaved={() => router.push(toOrgHref("/licenses/categories"))}
            onCancel={() => router.push(toOrgHref("/licenses/categories"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
