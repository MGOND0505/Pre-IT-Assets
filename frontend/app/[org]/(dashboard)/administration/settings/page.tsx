"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { apiClient, apiErrorMessage, publicLogoUrl, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useBranding } from "@/lib/branding-context"
import { isValidHexColor } from "@/lib/color-utils"

type NotificationChannel = "smtp" | "microsoft365" | "google"

type Settings = {
  assetIdCompanyPrefix: string
  warrantyAlertDays: number
  amcAlertDays: number
  licenseRenewalAlertDays: number[]
  licenseIdPrefix: string
  logoFileName: string
  teamName: string
  sidebarColor: string
  appBackgroundColor: string
  alertEmails: string[]
  alertEmailsCc: string[]
  alertEmailsBcc: string[]
  expiryAlertsEnabled: boolean
  assetChangeAlertsEnabled: boolean
  notificationChannel: NotificationChannel
  smtpHost: string
  smtpPort: number
  smtpUser: string
  smtpPasswordSet: boolean
  smtpSecure: boolean
  smtpFromEmail: string
  smtpFromName: string
  m365TenantId: string
  m365ClientId: string
  m365ClientSecretSet: boolean
  m365SenderEmail: string
  googleServiceAccountEmail: string
  googleServiceAccountPrivateKeySet: boolean
  googleSenderEmail: string
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const CHANNEL_OPTIONS: { value: NotificationChannel; label: string }[] = [
  { value: "smtp", label: "SMTP" },
  { value: "microsoft365", label: "Microsoft 365 / Outlook" },
  { value: "google", label: "Google Workspace / Gmail" },
]

export default function SettingsPage() {
  const { user, loading: authLoading } = useAuth()
  const { refresh: refreshBranding } = useBranding()
  const [settings, setSettings] = React.useState<Settings | null>(null)
  const [renewalDaysInput, setRenewalDaysInput] = React.useState("")
  const [alertEmailsInput, setAlertEmailsInput] = React.useState("")
  const [ccEmailsInput, setCcEmailsInput] = React.useState("")
  const [bccEmailsInput, setBccEmailsInput] = React.useState("")
  const [smtpPasswordInput, setSmtpPasswordInput] = React.useState("")
  const [m365ClientSecretInput, setM365ClientSecretInput] = React.useState("")
  const [googlePrivateKeyInput, setGooglePrivateKeyInput] = React.useState("")
  const [testEmailTo, setTestEmailTo] = React.useState("")
  const [sendingTestEmail, setSendingTestEmail] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const [submitting, setSubmitting] = React.useState(false)
  const [uploadingLogo, setUploadingLogo] = React.useState(false)
  const [logoVersion, setLogoVersion] = React.useState(0)
  const logoInputRef = React.useRef<HTMLInputElement>(null)

  const canView = can(user, "settings", "view")
  const canWrite = can(user, "settings", "update")

  React.useEffect(() => {
    if (!canView) return
    apiClient
      .get<ApiEnvelope<Settings>>("/settings")
      .then((res) => {
        setSettings(res.data.data)
        setRenewalDaysInput(res.data.data.licenseRenewalAlertDays.join(", "))
        setAlertEmailsInput(res.data.data.alertEmails.join(", "))
        setCcEmailsInput(res.data.data.alertEmailsCc.join(", "))
        setBccEmailsInput(res.data.data.alertEmailsBcc.join(", "))
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

    if (settings.sidebarColor && !isValidHexColor(settings.sidebarColor)) {
      toast.error("Sidebar color must be a hex value like #1e3a8a")
      return
    }
    if (settings.appBackgroundColor && !isValidHexColor(settings.appBackgroundColor)) {
      toast.error("Background color must be a hex value like #f4f4f5")
      return
    }

    const parseEmails = (input: string) =>
      input
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)

    const alertEmails = parseEmails(alertEmailsInput)
    const alertEmailsCc = parseEmails(ccEmailsInput)
    const alertEmailsBcc = parseEmails(bccEmailsInput)

    if ([...alertEmails, ...alertEmailsCc, ...alertEmailsBcc].some((e) => !EMAIL_RE.test(e))) {
      toast.error("One or more alert email addresses look invalid")
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
        teamName: settings.teamName,
        sidebarColor: settings.sidebarColor,
        appBackgroundColor: settings.appBackgroundColor,
        alertEmails,
        alertEmailsCc,
        alertEmailsBcc,
        expiryAlertsEnabled: settings.expiryAlertsEnabled,
        assetChangeAlertsEnabled: settings.assetChangeAlertsEnabled,
        notificationChannel: settings.notificationChannel,
        smtpHost: settings.smtpHost,
        smtpPort: settings.smtpPort,
        smtpUser: settings.smtpUser,
        smtpPassword: smtpPasswordInput || undefined,
        smtpSecure: settings.smtpSecure,
        smtpFromEmail: settings.smtpFromEmail,
        smtpFromName: settings.smtpFromName,
        m365TenantId: settings.m365TenantId,
        m365ClientId: settings.m365ClientId,
        m365ClientSecret: m365ClientSecretInput || undefined,
        m365SenderEmail: settings.m365SenderEmail,
        googleServiceAccountEmail: settings.googleServiceAccountEmail,
        googleServiceAccountPrivateKey: googlePrivateKeyInput || undefined,
        googleSenderEmail: settings.googleSenderEmail,
      })
      setSettings(res.data.data)
      setRenewalDaysInput(res.data.data.licenseRenewalAlertDays.join(", "))
      setAlertEmailsInput(res.data.data.alertEmails.join(", "))
      setCcEmailsInput(res.data.data.alertEmailsCc.join(", "))
      setBccEmailsInput(res.data.data.alertEmailsBcc.join(", "))
      setSmtpPasswordInput("")
      setM365ClientSecretInput("")
      setGooglePrivateKeyInput("")
      toast.success("Settings saved")
      refreshBranding()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save settings"))
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSendTestEmail() {
    setSendingTestEmail(true)
    try {
      const res = await apiClient.post<ApiEnvelope<{ sentTo: string[] }>>("/settings/test-email", {
        to: testEmailTo.trim() || undefined,
      })
      toast.success(`Test email sent to ${res.data.data.sentTo.join(", ")}`)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not send test email"))
    } finally {
      setSendingTestEmail(false)
    }
  }

  async function handleLogoSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    const formData = new FormData()
    formData.append("file", file)

    setUploadingLogo(true)
    try {
      const res = await apiClient.post<ApiEnvelope<Settings>>("/settings/logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setSettings(res.data.data)
      setLogoVersion((v) => v + 1)
      toast.success("Logo updated")
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not upload logo"))
    } finally {
      setUploadingLogo(false)
      if (logoInputRef.current) logoInputRef.current.value = ""
    }
  }

  async function handleRemoveLogo() {
    setUploadingLogo(true)
    try {
      const res = await apiClient.delete<ApiEnvelope<Settings>>("/settings/logo")
      setSettings(res.data.data)
      setLogoVersion((v) => v + 1)
      toast.success("Logo removed")
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not remove logo"))
    } finally {
      setUploadingLogo(false)
    }
  }

  const logoUrl = publicLogoUrl(`?v=${logoVersion}`)

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
          <CardTitle>Branding</CardTitle>
          <CardDescription>Shown in the sidebar and on the login page.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            {settings.logoFileName ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl ?? undefined}
                alt="Current logo"
                className="h-12 max-w-40 rounded border bg-background object-contain p-1"
              />
            ) : (
              <div className="flex h-12 w-40 items-center justify-center rounded border border-dashed text-xs text-muted-foreground">
                No logo set
              </div>
            )}
            <div className="flex flex-col gap-2">
              <Label htmlFor="logo-upload" className="sr-only">
                Upload logo
              </Label>
              <input
                ref={logoInputRef}
                id="logo-upload"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                disabled={!canWrite || uploadingLogo}
                onChange={handleLogoSelected}
                className="text-sm"
              />
              <div className="flex gap-2">
                {settings.logoFileName && canWrite && (
                  <Button variant="outline" size="sm" onClick={handleRemoveLogo} disabled={uploadingLogo}>
                    Remove logo
                  </Button>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            PNG, JPG, WEBP, or SVG, up to 2MB. Shown in the sidebar, the login screen, and (PNG/JPG only) at the top
            of exported PDF reports.
          </p>

          <div className="flex flex-col gap-2 border-t pt-4">
            <Label htmlFor="team-name">Team / organization name</Label>
            <Input
              id="team-name"
              disabled={!canWrite}
              value={settings.teamName}
              onChange={(e) => setSettings({ ...settings, teamName: e.target.value })}
              placeholder="e.g. Acme Corporation"
              maxLength={80}
            />
            <p className="text-xs text-muted-foreground">
              Shown next to the logo (or in its place, if no logo is set) on the sidebar, login screen, and PDF report
              headers.
            </p>
          </div>

          <div className="flex flex-col gap-2 border-t pt-4">
            <Label htmlFor="sidebar-color">Sidebar &amp; topbar color</Label>
            <div className="flex items-center gap-2">
              <input
                id="sidebar-color"
                type="color"
                disabled={!canWrite}
                value={isValidHexColor(settings.sidebarColor) ? settings.sidebarColor : "#ffffff"}
                onChange={(e) => setSettings({ ...settings, sidebarColor: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded border p-1 disabled:cursor-not-allowed"
              />
              <Input
                disabled={!canWrite}
                value={settings.sidebarColor}
                onChange={(e) => setSettings({ ...settings, sidebarColor: e.target.value })}
                placeholder="#1e3a8a"
                maxLength={7}
                className="max-w-32"
              />
              {canWrite && settings.sidebarColor && (
                <Button variant="outline" size="sm" onClick={() => setSettings({ ...settings, sidebarColor: "" })}>
                  Reset
                </Button>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="background-color">App background color</Label>
            <div className="flex items-center gap-2">
              <input
                id="background-color"
                type="color"
                disabled={!canWrite}
                value={isValidHexColor(settings.appBackgroundColor) ? settings.appBackgroundColor : "#ffffff"}
                onChange={(e) => setSettings({ ...settings, appBackgroundColor: e.target.value })}
                className="h-9 w-12 cursor-pointer rounded border p-1 disabled:cursor-not-allowed"
              />
              <Input
                disabled={!canWrite}
                value={settings.appBackgroundColor}
                onChange={(e) => setSettings({ ...settings, appBackgroundColor: e.target.value })}
                placeholder="#f4f4f5"
                maxLength={7}
                className="max-w-32"
              />
              {canWrite && settings.appBackgroundColor && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSettings({ ...settings, appBackgroundColor: "" })}
                >
                  Reset
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Backdrop behind the dashboard content and the login screen. Leave both colors blank to use the default
              theme.
            </p>
          </div>

          {canWrite && (
            <Button onClick={handleSave} disabled={submitting} className="self-start">
              {submitting ? "Saving..." : "Save branding"}
            </Button>
          )}
        </CardContent>
      </Card>

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

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Email alerts</CardTitle>
          <CardDescription>
            Where alert emails are sent from, and who receives them. Nothing is sent until SMTP is configured below
            and at least one recipient is added.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="alert-emails">Alert recipient emails (comma-separated)</Label>
            <Input
              id="alert-emails"
              disabled={!canWrite}
              value={alertEmailsInput}
              onChange={(e) => setAlertEmailsInput(e.target.value)}
              placeholder="it-manager@company.com, admin@company.com"
            />
            <p className="text-xs text-muted-foreground">Add as many recipients as needed, separated by commas.</p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="cc-emails">Cc (comma-separated)</Label>
              <Input
                id="cc-emails"
                disabled={!canWrite}
                value={ccEmailsInput}
                onChange={(e) => setCcEmailsInput(e.target.value)}
                placeholder="optional"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bcc-emails">Bcc (comma-separated)</Label>
              <Input
                id="bcc-emails"
                disabled={!canWrite}
                value={bccEmailsInput}
                onChange={(e) => setBccEmailsInput(e.target.value)}
                placeholder="optional"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-4 border-t pt-4">
            <div>
              <Label htmlFor="expiry-alerts-enabled">Warranty / AMC / license expiry alerts</Label>
              <p className="text-xs text-muted-foreground">
                Daily digest email when items cross the thresholds set above.
              </p>
            </div>
            <input
              id="expiry-alerts-enabled"
              type="checkbox"
              disabled={!canWrite}
              checked={settings.expiryAlertsEnabled}
              onChange={(e) => setSettings({ ...settings, expiryAlertsEnabled: e.target.checked })}
              className="size-4"
            />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label htmlFor="asset-change-alerts-enabled">Asset change alerts</Label>
              <p className="text-xs text-muted-foreground">
                Email when an asset is added, deleted, or has a significant field (status, owner, location,
                department, condition) edited. CSV imports send one summary email instead of one per row.
              </p>
            </div>
            <input
              id="asset-change-alerts-enabled"
              type="checkbox"
              disabled={!canWrite}
              checked={settings.assetChangeAlertsEnabled}
              onChange={(e) => setSettings({ ...settings, assetChangeAlertsEnabled: e.target.checked })}
              className="size-4"
            />
          </div>

          <div className="flex flex-col gap-2 border-t pt-4">
            <Label htmlFor="notification-channel">Notification method</Label>
            <Select
              value={settings.notificationChannel}
              onValueChange={(v) => setSettings({ ...settings, notificationChannel: v as NotificationChannel })}
            >
              <SelectTrigger id="notification-channel" className="w-full" disabled={!canWrite}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHANNEL_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Only the selected method is used to send alerts - configure its credentials below.
            </p>
          </div>

          {settings.notificationChannel === "smtp" && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="smtp-host">SMTP host</Label>
                  <Input
                    id="smtp-host"
                    disabled={!canWrite}
                    value={settings.smtpHost}
                    onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
                    placeholder="smtp.office365.com"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="smtp-port">SMTP port</Label>
                  <Input
                    id="smtp-port"
                    type="number"
                    disabled={!canWrite}
                    value={settings.smtpPort}
                    onChange={(e) => setSettings({ ...settings, smtpPort: Number(e.target.value) })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="smtp-user">SMTP username</Label>
                  <Input
                    id="smtp-user"
                    disabled={!canWrite}
                    value={settings.smtpUser}
                    onChange={(e) => setSettings({ ...settings, smtpUser: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="smtp-password">SMTP password</Label>
                  <Input
                    id="smtp-password"
                    type="password"
                    disabled={!canWrite}
                    value={smtpPasswordInput}
                    onChange={(e) => setSmtpPasswordInput(e.target.value)}
                    placeholder={settings.smtpPasswordSet ? "Set (leave blank to keep)" : ""}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="smtp-from-email">From email</Label>
                  <Input
                    id="smtp-from-email"
                    disabled={!canWrite}
                    value={settings.smtpFromEmail}
                    onChange={(e) => setSettings({ ...settings, smtpFromEmail: e.target.value })}
                    placeholder="alerts@company.com"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="smtp-from-name">From name</Label>
                  <Input
                    id="smtp-from-name"
                    disabled={!canWrite}
                    value={settings.smtpFromName}
                    onChange={(e) => setSettings({ ...settings, smtpFromName: e.target.value })}
                    placeholder="Notifications"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-4">
                <Label htmlFor="smtp-secure">Use TLS/SSL (port 465)</Label>
                <input
                  id="smtp-secure"
                  type="checkbox"
                  disabled={!canWrite}
                  checked={settings.smtpSecure}
                  onChange={(e) => setSettings({ ...settings, smtpSecure: e.target.checked })}
                  className="size-4"
                />
              </div>
            </>
          )}

          {settings.notificationChannel === "microsoft365" && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-muted-foreground">
                Requires an Azure AD app registration with the application permission <b>Mail.Send</b> and admin
                consent granted. The sender must be a real mailbox in the tenant.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="m365-tenant">Tenant ID</Label>
                  <Input
                    id="m365-tenant"
                    disabled={!canWrite}
                    value={settings.m365TenantId}
                    onChange={(e) => setSettings({ ...settings, m365TenantId: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="m365-client">Client ID</Label>
                  <Input
                    id="m365-client"
                    disabled={!canWrite}
                    value={settings.m365ClientId}
                    onChange={(e) => setSettings({ ...settings, m365ClientId: e.target.value })}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="m365-secret">Client secret</Label>
                  <Input
                    id="m365-secret"
                    type="password"
                    disabled={!canWrite}
                    value={m365ClientSecretInput}
                    onChange={(e) => setM365ClientSecretInput(e.target.value)}
                    placeholder={settings.m365ClientSecretSet ? "Set (leave blank to keep)" : ""}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="m365-sender">Sender mailbox</Label>
                  <Input
                    id="m365-sender"
                    disabled={!canWrite}
                    value={settings.m365SenderEmail}
                    onChange={(e) => setSettings({ ...settings, m365SenderEmail: e.target.value })}
                    placeholder="alerts@company.com"
                  />
                </div>
              </div>
            </div>
          )}

          {settings.notificationChannel === "google" && (
            <div className="flex flex-col gap-4">
              <p className="text-xs text-muted-foreground">
                Requires a Google Cloud service account authorized for domain-wide delegation in the Workspace admin
                console, with the Gmail scope <b>https://www.googleapis.com/auth/gmail.send</b>. The sender must be a
                real mailbox in the Workspace domain.
              </p>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="google-sa-email">Service account email</Label>
                  <Input
                    id="google-sa-email"
                    disabled={!canWrite}
                    value={settings.googleServiceAccountEmail}
                    onChange={(e) => setSettings({ ...settings, googleServiceAccountEmail: e.target.value })}
                    placeholder="alerts@project.iam.gserviceaccount.com"
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="google-sender">Sender mailbox</Label>
                  <Input
                    id="google-sender"
                    disabled={!canWrite}
                    value={settings.googleSenderEmail}
                    onChange={(e) => setSettings({ ...settings, googleSenderEmail: e.target.value })}
                    placeholder="alerts@company.com"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="google-private-key">Service account private key</Label>
                <Textarea
                  id="google-private-key"
                  rows={4}
                  disabled={!canWrite}
                  value={googlePrivateKeyInput}
                  onChange={(e) => setGooglePrivateKeyInput(e.target.value)}
                  placeholder={
                    settings.googleServiceAccountPrivateKeySet
                      ? "Set (leave blank to keep)"
                      : "-----BEGIN PRIVATE KEY-----..."
                  }
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  The <code>private_key</code> field from the service account&apos;s downloaded JSON key file.
                </p>
              </div>
            </div>
          )}

          {canWrite && (
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <Button onClick={handleSave} disabled={submitting}>
                {submitting ? "Saving..." : "Save email settings"}
              </Button>
              <Input
                value={testEmailTo}
                onChange={(e) => setTestEmailTo(e.target.value)}
                placeholder="Send test to (optional, defaults to recipients above)"
                className="max-w-72"
              />
              <Button variant="outline" onClick={handleSendTestEmail} disabled={sendingTestEmail}>
                {sendingTestEmail ? "Sending..." : "Send test email"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
