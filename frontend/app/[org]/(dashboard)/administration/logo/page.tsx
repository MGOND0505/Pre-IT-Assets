"use client"

import * as React from "react"
import { toast } from "sonner"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { OrgLogoUploadCard } from "@/components/organizations/org-logo-upload-card"
import { apiClient, apiErrorMessage, publicLogoUrl, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"

type LogoSettings = { logoFileName: string }

// A dedicated, single-purpose "Branding" surface for the Super Admin's per-organization tabs
// (organization/page.tsx), alongside the existing general Administration > Settings page (whose
// own Branding card - administration/settings/page.tsx - is untouched and still works the same
// way for that org's own Admin/Team Member). Hits the same existing /settings/logo route.
export default function OrganizationLogoPage() {
  const { user, loading: authLoading } = useAuth()
  const [settings, setSettings] = React.useState<LogoSettings | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [logoVersion, setLogoVersion] = React.useState(0)

  const canView = can(user, "settings", "view")
  const canWrite = can(user, "settings", "update")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<LogoSettings>>("/settings")
      setSettings(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load logo"))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (canView) load()
  }, [canView, load])

  async function handleUpload(file: File) {
    const formData = new FormData()
    formData.append("file", file)
    const res = await apiClient.post<ApiEnvelope<LogoSettings>>("/settings/logo", formData, {
      headers: { "Content-Type": "multipart/form-data" },
    })
    setSettings(res.data.data)
    setLogoVersion((v) => v + 1)
  }

  async function handleRemove() {
    const res = await apiClient.delete<ApiEnvelope<LogoSettings>>("/settings/logo")
    setSettings(res.data.data)
    setLogoVersion((v) => v + 1)
  }

  if (authLoading || loading) return null
  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }
  if (!settings) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Branding</h1>
        <p className="text-sm text-muted-foreground">
          Upload or replace this organization's logo. It appears in its sidebar and on its login page.
        </p>
      </div>
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Branding</CardTitle>
          <CardDescription>Shown in this organization's sidebar and on its login page.</CardDescription>
        </CardHeader>
        <CardContent>
          <OrgLogoUploadCard
            logoUrl={publicLogoUrl(`?v=${logoVersion}`)}
            hasLogo={Boolean(settings.logoFileName)}
            canWrite={canWrite}
            onUpload={handleUpload}
            onRemove={handleRemove}
          />
        </CardContent>
      </Card>
    </div>
  )
}
