"use client"

import { useRouter } from "next/navigation"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HelpdeskPriorityForm, EMPTY_HELPDESK_PRIORITY_FORM } from "@/components/helpdesk-priorities/helpdesk-priority-form"
import { useAuth } from "@/lib/auth-context"
import { useOrgHref } from "@/lib/use-org-href"

export default function AddHelpdeskPriorityPage() {
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
        <h1 className="text-2xl font-semibold tracking-tight">Add Ticket Priority</h1>
        <p className="text-sm text-muted-foreground">Define an SLA-backed priority level for tickets.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>New priority</CardTitle>
        </CardHeader>
        <CardContent>
          <HelpdeskPriorityForm
            initial={EMPTY_HELPDESK_PRIORITY_FORM}
            onSaved={() => router.push(toOrgHref("/helpdesk/priorities"))}
            onCancel={() => router.push(toOrgHref("/helpdesk/priorities"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
