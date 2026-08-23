"use client"

import { useRouter } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AssetForm, EMPTY_ASSET_FORM } from "@/components/assets/asset-form"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"

export default function AddAssetPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  const canCreate = can(user, "assets", "add")

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
            onSaved={(assetId) => router.push(`/assets/${assetId}`)}
            onCancel={() => router.push("/assets")}
          />
        </CardContent>
      </Card>
    </div>
  )
}
