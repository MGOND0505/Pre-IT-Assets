"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CustomFieldDefinitionForm,
  toCustomFieldDefinitionFormValues,
  type CustomFieldDefinition,
} from "@/components/custom-fields/custom-field-definition-form"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can, canConfigureAssetStructure } from "@/lib/permissions"
import { type CustomFieldModule } from "@/lib/use-lookup-options"
import { useOrgHref } from "@/lib/use-org-href"

const RESTRICTED_MODULES: CustomFieldModule[] = ["assets", "licenses", "vendors"]

export default function EditCustomFieldPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [definition, setDefinition] = React.useState<CustomFieldDefinition | null>(null)
  const [loading, setLoading] = React.useState(true)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<CustomFieldDefinition>>(`/custom-field-definitions/${params.id}`)
      setDefinition(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load custom field"))
    } finally {
      setLoading(false)
    }
  }, [params.id])

  React.useEffect(() => {
    load()
  }, [load])

  if (authLoading || loading) return null
  if (!definition) return null

  const isRestricted = RESTRICTED_MODULES.includes(definition.module)
  const canWrite = isRestricted
    ? canConfigureAssetStructure(user, "customFields", "update")
    : can(user, "customFields", "update")

  if (!canWrite) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Custom Field</h1>
        <p className="text-sm text-muted-foreground">{definition.label}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Custom field details</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomFieldDefinitionForm
            module={definition.module}
            initial={toCustomFieldDefinitionFormValues(definition)}
            onSaved={() => router.push(toOrgHref("/custom-fields"))}
            onCancel={() => router.push(toOrgHref("/custom-fields"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
