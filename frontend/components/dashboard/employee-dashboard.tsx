"use client"

import * as React from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Boxes, CheckCircle2, ListChecks, Ticket as TicketIcon } from "lucide-react"

import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { KpiCard, KpiGridSkeleton } from "@/components/dashboard/kpi-card"
import { SectionHeading } from "@/components/dashboard/section-heading"

type AssetSummary = { total: number; byStatus: Record<string, number> }
type TicketSummary = { total: number; open: number; byStatus: Record<string, number> }
type TaskSummary = { total: number; pending: number; byStatus: Record<string, number> }

/** The Employee Portal's dashboard - deliberately narrow compared to AdminDashboard's org-wide
 * view: just this one person's own assigned assets/filed tickets/assigned-or-created tasks (the
 * existing /assets, /helpdesk, /tasks list pages already scope to "mine" for a non-view-all
 * caller, so the links below need no special query param), plus a compact status summary. No
 * charts, no org-wide numbers, no admin actions - see the approved plan's "Status summary only"
 * decision for why there's no notification feed here. */
export function EmployeeDashboard() {
  const { user } = useAuth()
  const toOrgHref = useOrgHref()

  const hasAssetsModule = Boolean(user?.organization?.enabledModules.includes("assets"))
  const hasHelpdeskModule = Boolean(user?.organization?.enabledModules.includes("helpdesk"))
  const hasTasksModule = Boolean(user?.organization?.enabledModules.includes("tasks"))
  const canViewAssets = can(user, "assets", "view") && hasAssetsModule
  const canViewTickets = can(user, "helpdesk", "view") && hasHelpdeskModule
  const canViewTasks = can(user, "tasks", "view") && hasTasksModule

  const [assets, setAssets] = React.useState<AssetSummary | null>(null)
  const [tickets, setTickets] = React.useState<TicketSummary | null>(null)
  const [tasks, setTasks] = React.useState<TaskSummary | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      try {
        const [assetsRes, ticketsRes, tasksRes] = await Promise.all([
          canViewAssets ? apiClient.get<ApiEnvelope<AssetSummary>>("/assets/my-summary") : null,
          canViewTickets ? apiClient.get<ApiEnvelope<TicketSummary>>("/helpdesk/my-summary") : null,
          canViewTasks ? apiClient.get<ApiEnvelope<TaskSummary>>("/tasks/my-summary") : null,
        ])
        if (cancelled) return
        setAssets(assetsRes?.data.data ?? null)
        setTickets(ticketsRes?.data.data ?? null)
        setTasks(tasksRes?.data.data ?? null)
      } catch (err) {
        if (!cancelled) toast.error(apiErrorMessage(err, "Could not load your dashboard"))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [canViewAssets, canViewTickets, canViewTasks])

  const openTicketStatuses = Object.entries(tickets?.byStatus ?? {}).filter(
    ([status]) => status !== "Resolved" && status !== "Closed"
  )
  const pendingTaskStatuses = Object.entries(tasks?.byStatus ?? {}).filter(
    ([status]) => status !== "Done" && status !== "Cancelled"
  )

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Welcome, {user?.name}</h1>
        <p className="text-sm text-muted-foreground">Your assets, tickets, and tasks at a glance.</p>
      </div>

      {loading ? (
        <KpiGridSkeleton count={3} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {canViewAssets && (
            <Link href={toOrgHref("/assets")}>
              <KpiCard label="My Assets" value={assets?.total ?? 0} icon={Boxes} bucket="info" />
            </Link>
          )}
          {canViewTickets && (
            <Link href={toOrgHref("/helpdesk")}>
              <KpiCard
                label="My Tickets"
                value={tickets?.total ?? 0}
                icon={TicketIcon}
                bucket="info"
                subtitle={`${tickets?.open ?? 0} open`}
              />
            </Link>
          )}
          {canViewTasks && (
            <Link href={toOrgHref("/tasks")}>
              <KpiCard
                label="My Tasks"
                value={tasks?.total ?? 0}
                icon={ListChecks}
                bucket="info"
                subtitle={`${tasks?.pending ?? 0} pending`}
              />
            </Link>
          )}
        </div>
      )}

      {!loading && (canViewTickets || canViewTasks) && (
        <div className="flex flex-col gap-3">
          <SectionHeading icon={CheckCircle2}>Status</SectionHeading>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {canViewTickets && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Open tickets by status</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {openTicketStatuses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing open right now.</p>
                  ) : (
                    openTicketStatuses.map(([status, count]) => (
                      <Badge key={status} variant="outline">
                        {status}: {count}
                      </Badge>
                    ))
                  )}
                </CardContent>
              </Card>
            )}
            {canViewTasks && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Pending tasks by status</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {pendingTaskStatuses.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nothing pending right now.</p>
                  ) : (
                    pendingTaskStatuses.map(([status, count]) => (
                      <Badge key={status} variant="outline">
                        {status}: {count}
                      </Badge>
                    ))
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
