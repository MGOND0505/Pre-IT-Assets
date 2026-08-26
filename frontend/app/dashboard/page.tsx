"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Building2,
  Users,
  Boxes,
  Ticket as TicketIcon,
  ShieldAlert,
  History,
  RefreshCw,
  UserCog,
  Tags,
} from "lucide-react"

import { SuperAdminShell } from "@/components/layout/super-admin-shell"
import { FullPageLoader } from "@/components/layout/full-page-loader"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { KpiCard, KpiGridSkeleton, BUCKET_COLOR, type Bucket } from "@/components/dashboard/kpi-card"
import { SystemHealthCard } from "@/components/dashboard/system-health-card"
import { ChartCard, MultiSeriesTooltip, DonutTooltip, useChartTheme } from "@/components/dashboard/chart-card"
import { SectionHeading } from "@/components/dashboard/section-heading"
import { ActivityFeed, ActivityFeedSkeleton, type ActivityEntry } from "@/components/dashboard/activity-feed"
import { RevealGroup, RevealItem } from "@/components/dashboard/reveal"
import { TicketInsightsCard, TicketAlertsCard, type TicketInsights, type TicketAlert } from "@/components/dashboard/ticket-insights-alerts"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"

type DashboardStats = {
  organizations: { total: number; active: number }
  users: { total: number; newInPeriod: number }
  assets: { total: number; newInPeriod: number }
  tickets: {
    open: number
    newInPeriod: number
    byStatus: Record<string, number>
    slaBreaches: number
    topCategories: { name: string; count: number }[]
    trend: { date: string; open: number; resolved: number; closed: number }[]
  }
  insights: TicketInsights
  alerts: TicketAlert[]
  recentActivity: ActivityEntry[]
}

type OrgOption = { _id: string; name: string; slug: string }

// Same status -> semantic-bucket mapping the org-scoped dashboard uses, so "open" always reads
// as info-blue and "resolved" always reads as good-green everywhere in the app, never by
// position in whatever order the aggregation happens to return.
const STATUS_BUCKET: Record<string, Bucket> = {
  New: "info",
  Open: "info",
  "In Progress": "info",
  Pending: "warning",
  Reopened: "warning",
  Resolved: "good",
  Closed: "muted",
}

function bucketOf(status: string): Bucket {
  return STATUS_BUCKET[status] ?? "info"
}

function weekdayLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })
}

function lastUpdatedLabel(date: Date | null): string {
  if (!date) return ""
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "Updated just now"
  if (mins < 60) return `Updated ${mins}m ago`
  return `Updated at ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
}

const MAX_BAR_SIZE = 24

export default function SuperAdminDashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const chartTheme = useChartTheme()
  const [stats, setStats] = React.useState<DashboardStats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null)
  const [days, setDays] = React.useState(7)
  const [organizationId, setOrganizationId] = React.useState<string>("all")
  const [orgOptions, setOrgOptions] = React.useState<OrgOption[]>([])

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

  React.useEffect(() => {
    if (user?.role !== "superAdmin") return
    apiClient
      .get<ApiEnvelope<{ items: OrgOption[] }>>("/organizations", { params: { limit: 200 } })
      .then((res) => setOrgOptions(res.data.data.items))
      .catch(() => setOrgOptions([]))
  }, [user?.role])

  const load = React.useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true)
      else setLoading(true)
      try {
        const res = await apiClient.get<ApiEnvelope<DashboardStats>>("/organizations/dashboard-stats", {
          params: { days, organizationId: organizationId === "all" ? undefined : organizationId },
        })
        setStats(res.data.data)
        setLastUpdated(new Date())
      } catch (err) {
        toast.error(apiErrorMessage(err, "Could not load dashboard"))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [days, organizationId]
  )

  React.useEffect(() => {
    if (user?.role === "superAdmin") load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.role, days, organizationId])

  if (authLoading || !user || user.role !== "superAdmin") return <FullPageLoader />

  const selectedOrgSlug = orgOptions.find((o) => o._id === organizationId)?.slug ?? null

  const statusChartData = Object.entries(stats?.tickets.byStatus ?? {}).map(([status, count]) => ({
    status,
    count,
    fill: BUCKET_COLOR[bucketOf(status)],
  }))
  const ticketStatusTotal = statusChartData.reduce((sum, entry) => sum + entry.count, 0)
  const topCategoriesData = [...(stats?.tickets.topCategories ?? [])].sort((a, b) => b.count - a.count)
  const trendData = (stats?.tickets.trend ?? []).map((d) => ({ ...d, label: weekdayLabel(d.date) }))

  return (
    <SuperAdminShell>
      <div className="flex flex-col gap-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-[1.65rem] font-semibold tracking-tight">Platform Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
              {" · "}An overview across every organization on the platform.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-2">
              <Select value={organizationId} onValueChange={(v) => setOrganizationId(v ?? "all")}>
                <SelectTrigger size="sm" className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Organizations</SelectItem>
                  {orgOptions.map((org) => (
                    <SelectItem key={org._id} value={org._id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={String(days)} onValueChange={(v) => setDays(Number(v ?? 7))}>
                <SelectTrigger size="sm" className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">Last 7 days</SelectItem>
                  <SelectItem value="14">Last 14 days</SelectItem>
                  <SelectItem value="30">Last 30 days</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing || loading}>
                <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
            {lastUpdated && <span className="text-xs text-muted-foreground">{lastUpdatedLabel(lastUpdated)}</span>}
          </div>
        </div>

        {loading || !stats ? (
          <KpiGridSkeleton count={6} className="sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-6" />
        ) : (
          <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 xl:grid-cols-6">
            <RevealItem>
              <KpiCard
                label="Organizations"
                value={stats.organizations.total}
                icon={Building2}
                subtitle={`Active: ${stats.organizations.active}`}
              />
            </RevealItem>
            <RevealItem>
              <KpiCard
                label="Users"
                value={stats.users.total}
                icon={Users}
                bucket="info"
                subtitle={stats.users.newInPeriod > 0 ? `+${stats.users.newInPeriod} in last ${days}d` : `None in last ${days}d`}
              />
            </RevealItem>
            <RevealItem>
              <KpiCard
                label="Assets"
                value={stats.assets.total}
                icon={Boxes}
                subtitle={stats.assets.newInPeriod > 0 ? `+${stats.assets.newInPeriod} in last ${days}d` : `None in last ${days}d`}
              />
            </RevealItem>
            <RevealItem>
              <KpiCard
                label="Open Tickets"
                value={stats.tickets.open}
                icon={TicketIcon}
                bucket="info"
                subtitle={stats.tickets.newInPeriod > 0 ? `+${stats.tickets.newInPeriod} in last ${days}d` : `None in last ${days}d`}
                sparkline={trendData.map((d) => d.open)}
              />
            </RevealItem>
            <RevealItem>
              <KpiCard
                label="SLA Breaches"
                value={stats.tickets.slaBreaches}
                icon={ShieldAlert}
                bucket={stats.tickets.slaBreaches > 0 ? "critical" : "good"}
                subtitle="Past due, unresolved"
              />
            </RevealItem>
            <RevealItem>
              <SystemHealthCard />
            </RevealItem>
          </RevealGroup>
        )}

        {!loading && stats && (
          <RevealGroup className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <RevealItem className="lg:col-span-1">
              <ChartCard title="Tickets by status" isEmpty={statusChartData.length === 0} emptyMessage="No tickets yet.">
                <div className="flex h-full items-center gap-2">
                  <div className="relative h-full min-w-0 flex-1">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip content={<DonutTooltip />} />
                        <Pie
                          data={statusChartData}
                          dataKey="count"
                          nameKey="status"
                          innerRadius="62%"
                          outerRadius="90%"
                          paddingAngle={2}
                          strokeWidth={0}
                          animationDuration={600}
                        >
                          {statusChartData.map((entry) => (
                            <Cell
                              key={entry.status}
                              fill={entry.fill}
                              className={selectedOrgSlug ? "cursor-pointer transition-opacity hover:opacity-80" : "transition-opacity hover:opacity-80"}
                              onClick={
                                selectedOrgSlug
                                  ? () => router.push(`/${selectedOrgSlug}/helpdesk?status=${encodeURIComponent(entry.status)}`)
                                  : undefined
                              }
                            />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-semibold tracking-tight tabular-nums">{ticketStatusTotal}</span>
                      <span className="text-xs text-muted-foreground">Total</span>
                    </div>
                  </div>
                  <div className="flex w-32 shrink-0 flex-col gap-2">
                    {statusChartData.map((entry) => {
                      const pct = ticketStatusTotal > 0 ? Math.round((entry.count / ticketStatusTotal) * 100) : 0
                      const row = (
                        <>
                          <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: entry.fill }} />
                          <span className="min-w-0 flex-1 truncate text-xs text-foreground">{entry.status}</span>
                          <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{pct}%</span>
                        </>
                      )
                      return selectedOrgSlug ? (
                        <button
                          key={entry.status}
                          type="button"
                          onClick={() => router.push(`/${selectedOrgSlug}/helpdesk?status=${encodeURIComponent(entry.status)}`)}
                          className="flex items-center gap-1.5 text-left hover:opacity-75"
                        >
                          {row}
                        </button>
                      ) : (
                        <span key={entry.status} className="flex items-center gap-1.5">
                          {row}
                        </span>
                      )
                    })}
                  </div>
                </div>
                {!selectedOrgSlug && (
                  <p className="mt-2 text-center text-xs text-muted-foreground">
                    Select an organization above to drill into its tickets.
                  </p>
                )}
              </ChartCard>
            </RevealItem>

            <RevealItem className="lg:col-span-2">
              <ChartCard
                title={`Tickets created in the last ${days} days`}
                isEmpty={trendData.every((d) => d.open + d.resolved + d.closed === 0)}
                emptyMessage={`No tickets created in the last ${days} days.`}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trendData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                    <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: chartTheme.axisColor }}
                      axisLine={{ stroke: chartTheme.gridColor }}
                      tickLine={false}
                    />
                    <YAxis
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: chartTheme.axisColor }}
                      axisLine={{ stroke: chartTheme.gridColor }}
                      tickLine={false}
                    />
                    <Tooltip content={<MultiSeriesTooltip />} cursor={{ stroke: chartTheme.gridColor }} />
                    <Line type="monotone" dataKey="open" stroke={BUCKET_COLOR.info} strokeWidth={2} dot={{ r: 3 }} animationDuration={600} />
                    <Line type="monotone" dataKey="resolved" stroke={BUCKET_COLOR.good} strokeWidth={2} dot={{ r: 3 }} animationDuration={600} />
                    <Line type="monotone" dataKey="closed" stroke={BUCKET_COLOR.muted} strokeWidth={2} dot={{ r: 3 }} animationDuration={600} />
                  </LineChart>
                </ResponsiveContainer>
                <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                  {(["open", "resolved", "closed"] as const).map((key) => (
                    <span key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
                      <span className="h-2 w-3 shrink-0 rounded-full" style={{ backgroundColor: BUCKET_COLOR[key === "open" ? "info" : key === "resolved" ? "good" : "muted"] }} />
                      {key}
                    </span>
                  ))}
                </div>
              </ChartCard>
            </RevealItem>
          </RevealGroup>
        )}

        {!loading && stats && (
          <RevealGroup className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <RevealItem>
              <ChartCard
                title="Top ticket categories"
                isEmpty={topCategoriesData.length === 0}
                emptyMessage="No categorized tickets yet."
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topCategoriesData} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 4 }} barCategoryGap="30%">
                    <CartesianGrid horizontal={false} stroke={chartTheme.gridColor} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 12, fill: chartTheme.axisColor }}
                      axisLine={{ stroke: chartTheme.gridColor }}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={130}
                      tick={{ fontSize: 12, fill: chartTheme.axisColor }}
                      axisLine={{ stroke: chartTheme.gridColor }}
                      tickLine={false}
                    />
                    <Tooltip cursor={{ fill: chartTheme.cursorFill }} />
                    <Bar dataKey="count" fill={chartTheme.sequential} radius={[0, 4, 4, 0]} maxBarSize={MAX_BAR_SIZE} animationDuration={600} minPointSize={4} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </RevealItem>

            <RevealItem>
              <section className="flex h-full flex-col gap-4 rounded-xl border bg-card p-5 shadow-soft-sm">
                <SectionHeading icon={History}>Recent Activity</SectionHeading>
                <div className="flex-1 overflow-y-auto">
                  <ActivityFeed entries={stats.recentActivity} />
                </div>
              </section>
            </RevealItem>

            <RevealItem>
              <div className="flex flex-col gap-4">
                <TicketInsightsCard insights={stats.insights} />
                <TicketAlertsCard
                  alerts={stats.alerts}
                  hrefForAlert={(alert) => (alert.organizationSlug ? `/${alert.organizationSlug}/helpdesk/${alert.id}` : "/")}
                />
              </div>
            </RevealItem>
          </RevealGroup>
        )}

        {loading && (
          <RevealGroup className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <RevealItem>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <ActivityFeedSkeleton />
                </CardContent>
              </Card>
            </RevealItem>
          </RevealGroup>
        )}

        <section className="flex flex-col gap-4">
          <SectionHeading icon={Tags}>Quick Actions</SectionHeading>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <Link
              href="/"
              className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-soft-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-md"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Building2 className="size-4.5" />
              </span>
              <span className="text-sm font-medium">Organizations</span>
            </Link>
            <Link
              href="/sub-super-admins"
              className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-soft-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-md"
            >
              <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
                <UserCog className="size-4.5" />
              </span>
              <span className="text-sm font-medium">Sub-Super Admins</span>
            </Link>
          </div>
        </section>
      </div>
    </SuperAdminShell>
  )
}
