"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { hasPermission, PERM } from "@/lib/permissions"

type Settings = {
  assetIdCompanyPrefix: string
  warrantyAlertDays: number
  amcAlertDays: number
  licenseRenewalAlertDays: number[]
  licenseIdPrefix: string
}

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const [settings, setSettings] = React.useState<Settings | null>(null)
  const [renewalDaysInput, setRenewalDaysInput] = React.useState("")
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)

  const canView = hasPermission(user, PERM.SETTINGS_READ)
  const canWrite = hasPermission(user, PERM.SETTINGS_WRITE)

  React.useEffect(() => {
    if (!canView) return
    apiClient
      .get<ApiEnvelope<Settings>>("/settings")
      .then((res) => {
        setSettings(res.data.data)
        setRenewalDaysInput(res.data.data.licenseRenewalAlertDays.join(", "))
      })
      .catch((err) => toast.error(apiErrorMessage(err, "Could not load settings")))
      .finally(() => setLoading(false))
  }, [canView])

  async function handleSave() {
    if (!settings) return

    const renewalDays = renewalDaysInput
      .split(",")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0)

    if (renewalDays.length === 0) {
      toast.error("Enter at least one valid renewal alert day")
      return
    }

    setSubmitting(true)
    try {
      const res = await apiClient.put<ApiEnvelope<Settings>>("/settings", {
        assetIdCompanyPrefix: settings.assetIdCompanyPrefix,
        warrantyAlertDays: settings.warrantyAlertDays,
        amcAlertDays: settings.amcAlertDays,
        licenseIdPrefix: settings.licenseIdPrefix,
        licenseRenewalAlertDays: renewalDays,
      })
      setSettings(res.data.data)
      setRenewalDaysInput(res.data.data.licenseRenewalAlertDays.join(", "))
      toast.success("Settings saved")
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save settings"))
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading || loading) return null

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  if (!settings) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">
          System-wide alert thresholds and ID prefixes. Asset category prefixes are managed under Assets &rarr;
          Categories.
        </p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Alerts &amp; prefixes</CardTitle>
          <CardDescription>These control when warranty/AMC/license renewal notifications fire.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="asset-prefix">Asset ID company prefix</Label>
            <Input
              id="asset-prefix"
              disabled={!canWrite}
              value={settings.assetIdCompanyPrefix}
              onChange={(e) => setSettings({ ...settings, assetIdCompanyPrefix: e.target.value.toUpperCase() })}
              maxLength={10}
            />
            <p className="text-xs text-muted-foreground">
              Used in generated asset IDs, e.g. {settings.assetIdCompanyPrefix || "VNR"}-LAP-000001.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="warranty-days">Warranty alert (days before expiry)</Label>
            <Input
              id="warranty-days"
              type="number"
              min={1}
              disabled={!canWrite}
              value={settings.warrantyAlertDays}
              onChange={(e) => setSettings({ ...settings, warrantyAlertDays: Number(e.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="amc-days">AMC alert (days before expiry)</Label>
            <Input
              id="amc-days"
              type="number"
              min={1}
              disabled={!canWrite}
              value={settings.amcAlertDays}
              onChange={(e) => setSettings({ ...settings, amcAlertDays: Number(e.target.value) })}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="renewal-days">License renewal alerts (comma-separated days)</Label>
            <Input
              id="renewal-days"
              disabled={!canWrite}
              value={renewalDaysInput}
              onChange={(e) => setRenewalDaysInput(e.target.value)}
              placeholder="90, 60, 30, 15, 7"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="license-prefix">License ID prefix</Label>
            <Input
              id="license-prefix"
              disabled={!canWrite}
              value={settings.licenseIdPrefix}
              onChange={(e) => setSettings({ ...settings, licenseIdPrefix: e.target.value.toUpperCase() })}
              maxLength={10}
            />
          </div>
          {canWrite && (
            <Button onClick={handleSave} disabled={submitting} className="self-start">
              {submitting ? "Saving..." : "Save settings"}
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
