"use client"

import { useRouter } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AssetForm, EMPTY_ASSET_FORM } from "@/components/assets/asset-form"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

export default function AddAssetPage() {
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()

  const canCreate = can(user, "assets", "create")

  if (authLoading) return null
  if (!canCreate) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Asset</h1>
        <p className="text-sm text-muted-foreground">The Asset ID is generated automatically from the category.</p>
      </div>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>New asset</CardTitle>
        </CardHeader>
        <CardContent>
          <AssetForm
            initial={EMPTY_ASSET_FORM}
            onSaved={(assetId) => router.push(toOrgHref(`/assets/${assetId}`))}
            onCancel={() => router.push(toOrgHref("/assets"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
