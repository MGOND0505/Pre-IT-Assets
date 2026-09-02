"use client"

import { useRouter } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AssetCategoryForm, EMPTY_ASSET_CATEGORY_FORM } from "@/components/asset-categories/asset-category-form"
import { useAuth } from "@/lib/auth-context"
import { canConfigureAssetStructure } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

export default function AddAssetCategoryPage() {
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()

  const canCreate = canConfigureAssetStructure(user, "assetCategories", "create")

  if (authLoading) return null
  if (!canCreate) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Asset Category</h1>
        <p className="text-sm text-muted-foreground">Each category has its own ID prefix, e.g. VNR-LAP-000001.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New asset category</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetCategoryForm
            initial={EMPTY_ASSET_CATEGORY_FORM}
            onSaved={() => router.push(toOrgHref("/assets/categories"))}
            onCancel={() => router.push(toOrgHref("/assets/categories"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
