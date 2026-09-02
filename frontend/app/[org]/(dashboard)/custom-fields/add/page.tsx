"use client"

import { useRouter, useSearchParams } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  CustomFieldDefinitionForm,
  EMPTY_CUSTOM_FIELD_DEFINITION_FORM,
} from "@/components/custom-fields/custom-field-definition-form"
import { useAuth } from "@/lib/auth-context"
import { can, canConfigureAssetStructure } from "@/lib/permissions"
import { type CustomFieldModule } from "@/lib/use-lookup-options"
import { useOrgHref } from "@/lib/use-org-href"

const RESTRICTED_MODULES: CustomFieldModule[] = ["assets", "licenses", "vendors"]

export default function AddCustomFieldPage() {
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const searchParams = useSearchParams()
  const { user, loading: authLoading } = useAuth()

  const module = (searchParams.get("module") as CustomFieldModule | null) ?? "assets"
  const isRestricted = RESTRICTED_MODULES.includes(module)
  const canCreate = isRestricted ? canConfigureAssetStructure(user, "customFields", "create") : can(user, "customFields", "create")

  if (authLoading) return null
  if (!canCreate) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Custom Field</h1>
        <p className="text-sm text-muted-foreground">Define an extra field to capture on this module&apos;s records.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New custom field</CardTitle>
        </CardHeader>
        <CardContent>
          <CustomFieldDefinitionForm
            module={module}
            initial={EMPTY_CUSTOM_FIELD_DEFINITION_FORM}
            onSaved={() => router.push(toOrgHref("/custom-fields"))}
            onCancel={() => router.push(toOrgHref("/custom-fields"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
