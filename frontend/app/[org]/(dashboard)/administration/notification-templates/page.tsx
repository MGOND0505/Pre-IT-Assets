"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"

type TemplateKey =
  | "expiryDigest"
  | "assetCreated"
  | "assetUpdated"
  | "assetDeleted"
  | "assetsBulkDeleted"
  | "assetImportBatch"
  | "test"

type Template = { key: TemplateKey; subject: string; bodyHtml: string }

const TEMPLATE_META: Record<TemplateKey, { label: string; placeholders: string[] }> = {
  expiryDigest: {
    label: "Expiry digest (daily)",
    placeholders: ["date", "count", "warrantySection", "amcSection", "licenseSection"],
  },
  assetCreated: { label: "Asset added", placeholders: ["assetId", "name"] },
  assetUpdated: { label: "Asset updated", placeholders: ["assetId", "name", "changes"] },
  assetDeleted: { label: "Asset deleted", placeholders: ["assetId", "name"] },
  assetsBulkDeleted: { label: "Bulk delete", placeholders: ["count"] },
  assetImportBatch: { label: "CSV import summary", placeholders: ["added", "updated"] },
  test: { label: "Test email", placeholders: [] },
}

export default function NotificationTemplatesPage() {
  const { user, loading: authLoading } = useAuth()
  const [templates, setTemplates] = React.useState<Record<string, Template>>({})
  const [activeKey, setActiveKey] = React.useState<TemplateKey>("expiryDigest")
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)

  const canView = can(user, "settings", "view")
  const canWrite = can(user, "settings", "update")

  React.useEffect(() => {
    if (!canView) return
    apiClient
      .get<ApiEnvelope<Template[]>>("/settings/notification-templates")
      .then((res) => {
        const byKey: Record<string, Template> = {}
        for (const t of res.data.data) byKey[t.key] = t
        setTemplates(byKey)
      })
      .catch((err) => toast.error(apiErrorMessage(err, "Could not load templates")))
      .finally(() => setLoading(false))
  }, [canView])

  async function handleSave(key: TemplateKey) {
    const template = templates[key]
    if (!template) return
    setSaving(true)
    try {
      const res = await apiClient.put<ApiEnvelope<Template>>(`/settings/notification-templates/${key}`, {
        subject: template.subject,
        bodyHtml: template.bodyHtml,
      })
      setTemplates((prev) => ({ ...prev, [key]: res.data.data }))
      toast.success("Template saved")
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save template"))
    } finally {
      setSaving(false)
    }
  }

  if (authLoading || loading) return null

  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Notification Templates</h1>
        <p className="text-sm text-muted-foreground">
          Edit the subject and body of each alert email. Use the listed placeholders - they&apos;re replaced with
          real values when the email is sent.
        </p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle>Templates</CardTitle>
          <CardDescription>One template per notification type.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeKey} onValueChange={(v) => setActiveKey(v as TemplateKey)}>
            <TabsList className="flex-wrap">
              {Object.entries(TEMPLATE_META).map(([key, meta]) => (
                <TabsTrigger key={key} value={key}>
                  {meta.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {Object.entries(TEMPLATE_META).map(([key, meta]) => {
              const template = templates[key]
              if (!template) return null
              return (
                <TabsContent key={key} value={key}>
                  <div className="flex flex-col gap-4">
                    <p className="text-xs text-muted-foreground">
                      {meta.placeholders.length > 0
                        ? `Available placeholders: ${meta.placeholders.map((p) => `{{${p}}}`).join(", ")}`
                        : "This template has no placeholders."}
                    </p>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`${key}-subject`}>Subject</Label>
                      <Input
                        id={`${key}-subject`}
                        value={template.subject}
                        onChange={(e) =>
                          setTemplates((prev) => ({ ...prev, [key]: { ...template, subject: e.target.value } }))
                        }
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor={`${key}-body`}>Body (HTML)</Label>
                      <Textarea
                        id={`${key}-body`}
                        rows={8}
                        value={template.bodyHtml}
                        onChange={(e) =>
                          setTemplates((prev) => ({ ...prev, [key]: { ...template, bodyHtml: e.target.value } }))
                        }
                      />
                    </div>
                    {canWrite && (
                      <Button onClick={() => handleSave(key as TemplateKey)} disabled={saving} className="self-start">
                        {saving ? "Saving..." : "Save template"}
                      </Button>
                    )}
                  </div>
                </TabsContent>
              )
            })}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
