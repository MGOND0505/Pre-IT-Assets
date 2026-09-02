"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  HelpdeskPriorityForm,
  type HelpdeskPriorityFormValues,
} from "@/components/helpdesk-priorities/helpdesk-priority-form"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { useOrgHref } from "@/lib/use-org-href"

type HelpdeskPriority = {
  _id: string
  name: string
  order: number
  color: string
  slaResponseMinutes: number
  slaResolutionMinutes: number
  status: "Active" | "Inactive"
}

function toFormValues(priority: HelpdeskPriority): HelpdeskPriorityFormValues {
  return {
    _id: priority._id,
    name: priority.name,
    order: String(priority.order),
    color: priority.color,
    slaResponseMinutes: String(priority.slaResponseMinutes),
    slaResolutionMinutes: String(priority.slaResolutionMinutes),
  }
}

export default function EditHelpdeskPriorityPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [priority, setPriority] = React.useState<HelpdeskPriority | null>(null)
  const [loading, setLoading] = React.useState(true)

  const canWrite = Boolean(user?.isAdmin)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<HelpdeskPriority>>(`/helpdesk-priorities/${params.id}`)
      setPriority(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load priority"))
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
  if (!priority) return null

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Edit Ticket Priority</h1>
        <p className="text-sm text-muted-foreground">{priority.name}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Priority details</CardTitle>
        </CardHeader>
        <CardContent>
          <HelpdeskPriorityForm
            initial={toFormValues(priority)}
            onSaved={() => router.push(toOrgHref("/helpdesk/priorities"))}
            onCancel={() => router.push(toOrgHref("/helpdesk/priorities"))}
          />
        </CardContent>
      </Card>
    </div>
  )
}
