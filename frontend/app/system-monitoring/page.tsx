"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { formatDistanceToNow } from "date-fns"
import { RefreshCw, Clock3, ShieldAlert, KeyRound } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { SuperAdminShell } from "@/components/layout/super-admin-shell"
import { FullPageLoader } from "@/components/layout/full-page-loader"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"

type SchedulerRun = {
  schedulerKey: string
  lastRunAt: string
  success: boolean
  itemCount: number
  errorMessage: string | null
}

type SystemStatus = {
  schedulers: SchedulerRun[]
  rateLimitRejects: { auth: number; api: number; windowMinutes: number }
  loginActivity: { failedLast24h: number; lockoutsLast24h: number }
}

// Mirrors backend/src/services/monitoring/schedulerRun.service.ts's SCHEDULER_KEYS - the fixed set
// of 5 schedulers this page always shows a card for, in a stable display order, even when one
// hasn't produced a SchedulerRun row yet (shown as "Not yet run" rather than being omitted).
const KNOWN_SCHEDULERS: { key: string; label: string; description: string }[] = [
  { key: "expiryAlerts", label: "Expiry Alerts", description: "Daily 08:00 - warranty/AMC/license expiry digest emails" },
  { key: "organizationExpiry", label: "Organization Expiry", description: "Daily 08:00 - auto-suspends organizations past their subscription grace period" },
  { key: "recycleBinPurge", label: "Organization Recycle Bin Purge", description: "Daily 08:30 - permanently purges deleted organizations past their 90-day window" },
  { key: "dataRetention", label: "Data Retention Purge", description: "Daily 09:00 - permanently purges soft-deleted records past each org's retention window" },
  { key: "helpdeskEscalation", label: "Helpdesk SLA/Escalation", description: "Every 15 minutes - SLA warnings, breach escalation, overdue task notices" },
]

function SchedulerCard({ scheduler, run }: { scheduler: (typeof KNOWN_SCHEDULERS)[number]; run: SchedulerRun | undefined }) {
  const color = !run ? "var(--muted-foreground)" : run.success ? "var(--success)" : "var(--destructive)"

  return (
    <Card style={{ borderTopWidth: 3, borderTopColor: color }}>
      <CardContent className="flex flex-col gap-2 pt-6">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">{scheduler.label}</h3>
            <p className="text-xs text-muted-foreground">{scheduler.description}</p>
          </div>
          <Badge variant={!run ? "outline" : run.success ? "success" : "destructive"}>
            {!run ? "Not yet run" : run.success ? "Success" : "Failed"}
          </Badge>
        </div>
        {run ? (
          <div className="mt-1 flex flex-col gap-1 text-sm">
            <span className="text-muted-foreground">
              Last run {formatDistanceToNow(new Date(run.lastRunAt), { addSuffix: true })}
            </span>
            <span>
              <span className="font-medium">{run.itemCount}</span> item{run.itemCount === 1 ? "" : "s"} processed
            </span>
            {!run.success && run.errorMessage && (
              <span className="rounded-md bg-destructive/10 px-2 py-1 text-xs text-destructive">{run.errorMessage}</span>
            )}
          </div>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            Hasn&apos;t fired since the server last started (or is scheduled for later today).
          </p>
        )}
      </CardContent>
    </Card>
  )
}

/**
 * Phase 10's "System Monitoring" - the final phase of the plan. Extends (does not replace) the
 * Global Dashboard's SystemHealthCard (DB-connection-only) with the fuller operational picture:
 * each of the 5 background schedulers' last-run outcome, recent rate-limit rejection counts, and
 * recent login failure/lockout counts. Deliberately reports only real, cheap, checkable signals -
 * no invented CPU/memory/uptime numbers, since this app has no infrastructure to report those
 * from. A diagnostics page someone opens deliberately, so it's fetch-on-mount plus a manual
 * refresh button rather than an auto-poll. Follows the same flat-Super-Admin-page pattern as
 * Phase 8's /users and Phase 9's /security-settings.
 */
export default function SystemMonitoringPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [status, setStatus] = React.useState<SystemStatus | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace("/login")
      return
    }
    if (user.role !== "superAdmin") {
      router.replace(user.organization ? `/${user.organization.slug}` : "/")
    }
  }, [authLoading, user, router])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<SystemStatus>>("/system-status")
      setStatus(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load system status"))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (user?.role === "superAdmin") load()
  }, [user, load])

  if (authLoading || !user || user.role !== "superAdmin") return <FullPageLoader />
  if (loading || !status) {
    return (
      <SuperAdminShell>
        <FullPageLoader />
      </SuperAdminShell>
    )
  }

  const runsByKey = new Map(status.schedulers.map((run) => [run.schedulerKey, run]))

  return (
    <SuperAdminShell>
      <div className="flex flex-col gap-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">System Monitoring</h1>
            <p className="text-sm text-muted-foreground">
              Real, checkable operational signals from this app: background scheduler outcomes, rate-limit rejections,
              and login activity.
            </p>
          </div>
          <Button variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            Refresh
          </Button>
        </div>

        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            <Clock3 className="size-4" /> Schedulers
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {KNOWN_SCHEDULERS.map((scheduler) => (
              <SchedulerCard key={scheduler.key} scheduler={scheduler} run={runsByKey.get(scheduler.key)} />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="size-4" /> Rate Limiting
              </CardTitle>
              <CardDescription>
                Requests rejected with 429 in the last {status.rateLimitRejects.windowMinutes} minutes.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Auth limiter</span>
                <span className="text-2xl font-semibold tracking-tight">{status.rateLimitRejects.auth}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">API limiter</span>
                <span className="text-2xl font-semibold tracking-tight">{status.rateLimitRejects.api}</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-4" /> Login Activity
              </CardTitle>
              <CardDescription>Across every organization, in the last 24 hours.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Failed logins</span>
                <span className="text-2xl font-semibold tracking-tight">{status.loginActivity.failedLast24h}</span>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-xs text-muted-foreground">Lockouts</span>
                <span className="text-2xl font-semibold tracking-tight">{status.loginActivity.lockoutsLast24h}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </SuperAdminShell>
  )
}
