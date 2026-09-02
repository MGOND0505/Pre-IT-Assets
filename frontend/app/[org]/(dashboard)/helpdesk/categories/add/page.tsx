"use client"

import { useRouter } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HelpdeskCategoryForm, EMPTY_HELPDESK_CATEGORY_FORM } from "@/components/helpdesk-categories/helpdesk-category-form"
import { useAuth } from "@/lib/auth-context"
import { useOrgHref } from "@/lib/use-org-href"

export default function AddHelpdeskCategoryPage() {
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()

  const canCreate = Boolean(user?.isAdmin)

  if (authLoading) return null
  if (!canCreate) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Ticket Category</h1>
        <p className="text-sm text-muted-foreground">Organize tickets by category, with an optional default agent.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New category</CardTitle>
        </CardHeader>
        <CardContent>
          <HelpdeskCategoryForm
            initial={EMPTY_HELPDESK_CATEGORY_FORM}
            onSaved={() => router.push(toOrgHref("/helpdesk/categories"))}
            onCancel={() => router.push(toOrgHref("/helpdesk/categories"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
