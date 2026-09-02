"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  AssetCategoryForm,
  toAssetCategoryFormValues,
  type AssetCategory,
} from "@/components/asset-categories/asset-category-form"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { canConfigureAssetStructure } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

export default function EditAssetCategoryPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [category, setCategory] = React.useState<AssetCategory | null>(null)
  const [loading, setLoading] = React.useState(true)

  const canWrite = canConfigureAssetStructure(user, "assetCategories", "update")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<AssetCategory>>(`/asset-categories/${params.id}`)
      setCategory(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load asset category"))
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
        <h1 className="text-2xl font-semibold tracking-tight">Edit Asset Category</h1>
        <p className="text-sm text-muted-foreground">{category.name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Asset category details</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetCategoryForm
            initial={toAssetCategoryFormValues(category)}
            onSaved={() => router.push(toOrgHref("/assets/categories"))}
            onCancel={() => router.push(toOrgHref("/assets/categories"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
