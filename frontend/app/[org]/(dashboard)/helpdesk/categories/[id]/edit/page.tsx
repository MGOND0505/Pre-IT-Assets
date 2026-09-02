"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  HelpdeskCategoryForm,
  type HelpdeskCategoryFormValues,
} from "@/components/helpdesk-categories/helpdesk-category-form"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { useOrgHref } from "@/lib/use-org-href"

type HelpdeskCategory = {
  _id: string
  name: string
  description: string
  defaultAgent: { _id: string; name: string } | null
  status: "Active" | "Inactive"
}

function toFormValues(category: HelpdeskCategory): HelpdeskCategoryFormValues {
  return {
    _id: category._id,
    name: category.name,
    description: category.description,
    defaultAgent: category.defaultAgent?._id ?? "",
  }
}

export default function EditHelpdeskCategoryPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [category, setCategory] = React.useState<HelpdeskCategory | null>(null)
  const [loading, setLoading] = React.useState(true)

  const canWrite = Boolean(user?.isAdmin)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<HelpdeskCategory>>(`/helpdesk-categories/${params.id}`)
      setCategory(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load category"))
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
        <h1 className="text-2xl font-semibold tracking-tight">Edit Ticket Category</h1>
        <p className="text-sm text-muted-foreground">{category.name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Category details</CardTitle>
        </CardHeader>
        <CardContent>
          <HelpdeskCategoryForm
            initial={toFormValues(category)}
            onSaved={() => router.push(toOrgHref("/helpdesk/categories"))}
            onCancel={() => router.push(toOrgHref("/helpdesk/categories"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
