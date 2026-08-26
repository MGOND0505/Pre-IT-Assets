"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import Link from "next/link"
import {
  AlertTriangle,
  Archive,
  Boxes,
  CheckCircle2,
  IndianRupee,
  KeyRound,
  ShieldCheck,
  UserCheck,
  Wrench,
  XCircle,
  Activity,
  KeyRound as LicenseIcon,
  History,
  RefreshCw,
  Ticket as TicketIcon,
  ShieldAlert,
  ListChecks,
  BarChart3,
  Tags,
  Settings2,
  RotateCcw,
} from "lucide-react"
import { Line, LineChart, Pie, PieChart } from "recharts"

import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { FullPageLoader } from "@/components/layout/full-page-loader"
import { KpiCard, ValueKpiCard, KpiGridSkeleton, BUCKET_COLOR, type Bucket } from "@/components/dashboard/kpi-card"
import { ChartCard, ChartTooltip, MultiSeriesTooltip, DonutTooltip, useChartTheme } from "@/components/dashboard/chart-card"
import { SectionHeading } from "@/components/dashboard/section-heading"
import { AttentionBanner } from "@/components/dashboard/attention-banner"
import { ActivityFeed, ActivityFeedSkeleton, type ActivityEntry } from "@/components/dashboard/activity-feed"
import { RevealGroup, RevealItem } from "@/components/dashboard/reveal"
import { TicketInsightsCard, TicketAlertsCard, type TicketInsights, type TicketAlert } from "@/components/dashboard/ticket-insights-alerts"

type AssetStats = {
  total: number
  active: number
  totalValue: number
  byStatus: Record<string, number>
  byLocation: { locationId: string; name: string; count: number }[]
  byCategory: { categoryId: string; name: string; count: number }[]
  byDepartment: { departmentId: string; name: string; count: number }[]
  topAssignees: { userId: string; name: string; count: number }[]
  warrantyExpiringSoon: number
}

type LicenseStats = {
  total: number
  active: number
  expiringSoon: number
  expired: number
}

type HelpdeskSummary = {
  open: number
  newInPeriod: number
  byStatus: Record<string, number>
  slaBreaches: number
  topCategories: { name: string; count: number }[]
  trend: { date: string; open: number; resolved: number; closed: number }[]
  insights: TicketInsights
  alerts: TicketAlert[]
}

// Same status -> semantic-bucket mapping the Super Admin dashboard uses for tickets, so a
// status reads the same color everywhere in the app.
const TICKET_STATUS_BUCKET: Record<string, Bucket> = {
  New: "info",
  Open: "info",
  "In Progress": "info",
  Pending: "warning",
  Reopened: "warning",
  Resolved: "good",
  Closed: "muted",
}

function ticketBucketOf(status: string): Bucket {
  return TICKET_STATUS_BUCKET[status] ?? "info"
}

function weekdayLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" })
}

// Status colors carry real meaning (health/urgency), never assigned by position - the same
// status always gets the same color, unlike the API's aggregation order which isn't
// guaranteed stable.
const STATUS_BUCKET: Record<string, Bucket> = {
  Available: "good",
  "In Stock": "good",
  Assigned: "info",
  Reserved: "info",
  "Under Repair": "warning",
  "Under Maintenance": "warning",
  Damaged: "critical",
  Lost: "critical",
  Stolen: "critical",
  Retired: "muted",
  Disposed: "muted",
}

function bucketOf(status: string): Bucket {
  return STATUS_BUCKET[status] ?? "info"
}

// A small categorical palette (the app's existing --chart-1..5 tokens) for the location donut,
// which - unlike the status donut - has no inherent semantic color per slice (a location isn't
// "good" or "critical"), just identity. Cycles if there are more locations than colors.
const LOCATION_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"]

// A bar's thickness never fills its slot - capped so the surrounding whitespace stays part
// of the design, not just leftover space. Kept to one number so every chart on the page reads
// as one consistent family rather than a mix of thick and thin bars.
const MAX_BAR_SIZE = 24

function lastUpdatedLabel(date: Date | null): string {
  if (!date) return ""
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "Updated just now"
  if (mins < 60) return `Updated ${mins}m ago`
  return `Updated at ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
}

const GREETING_HOUR_MESSAGE = (hour: number) => (hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening")

type SectionKey = "assets" | "licenses" | "helpdesk" | "activity" | "quickActions"

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const toOrgHref = useOrgHref()
  const router = useRouter()
  const chartTheme = useChartTheme()
  const [assetStats, setAssetStats] = React.useState<AssetStats | null>(null)
  const [licenseStats, setLicenseStats] = React.useState<LicenseStats | null>(null)
  const [helpdeskSummary, setHelpdeskSummary] = React.useState<HelpdeskSummary | null>(null)
  const [activity, setActivity] = React.useState<ActivityEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null)
  const [days, setDays] = React.useState(7)

  // Permission alone isn't enough - an Admin passes can()'s isAdmin bypass regardless of this
  // org's subscription, so a module that's actually disabled for THIS org must also be excluded
  // here, or the stats fetch below 403s ("module not enabled") and leaves the section stuck on
  // its loading skeleton forever. Mirrors nav-config.ts's exact same two-part gate.
  const hasAssetsModule = user?.role === "superAdmin" || Boolean(user?.organization?.enabledModules.includes("assets"))
  const hasLicensesModule = user?.role === "superAdmin" || Boolean(user?.organization?.enabledModules.includes("licenses"))
  const hasHelpdeskModule = user?.role === "superAdmin" || Boolean(user?.organization?.enabledModules.includes("helpdesk"))
  const canViewAssets = can(user, "assets", "view") && hasAssetsModule
  const canViewLicenses = can(user, "licenses", "view") && hasLicensesModule
  const canViewHelpdesk = can(user, "helpdesk", "view") && hasHelpdeskModule
  const canCreateAssets = can(user, "assets", "create") && hasAssetsModule
  const canCreateTickets = can(user, "helpdesk", "create") && hasHelpdeskModule
  const canCreateTasks =
    can(user, "tasks", "create") && (user?.role === "superAdmin" || Boolean(user?.organization?.enabledModules.includes("tasks")))
  const canViewReports =
    can(user, "reports", "view") && (user?.role === "superAdmin" || Boolean(user?.organization?.enabledModules.includes("reports")))
  const canViewDashboard = can(user, "dashboard", "view")
  const canViewAuditLogs = can(user, "auditLogs", "view")

  const [customizeOpen, setCustomizeOpen] = React.useState(false)
  const [hiddenSections, setHiddenSections] = React.useState<Set<SectionKey>>(new Set())
  const [sectionPrefsLoaded, setSectionPrefsLoaded] = React.useState(false)

  const sectionPrefsKey = user?.organization
    ? `dashboard-sections:${user.organization.slug}:${user._id}`
    : null

  // Loaded once per user - a per-viewer convenience like every other localStorage use in this
  // app, never load-bearing (a blocked/private-mode localStorage just means every section shows,
  // same as before this feature existed).
  React.useEffect(() => {
    if (!sectionPrefsKey || sectionPrefsLoaded) return
    try {
      const raw = window.localStorage.getItem(sectionPrefsKey)
      if (raw) setHiddenSections(new Set(JSON.parse(raw) as SectionKey[]))
    } catch {
      // Ignore - fall back to showing every section.
    }
    setSectionPrefsLoaded(true)
  }, [sectionPrefsKey, sectionPrefsLoaded])

  function persistHiddenSections(next: Set<SectionKey>) {
    if (!sectionPrefsKey) return
    try {
      window.localStorage.setItem(sectionPrefsKey, JSON.stringify(Array.from(next)))
    } catch {
      // Ignore.
    }
  }

  function toggleSection(key: SectionKey, visible: boolean) {
    setHiddenSections((prev) => {
      const next = new Set(prev)
      if (visible) next.delete(key)
      else next.add(key)
      persistHiddenSections(next)
      return next
    })
  }

  function resetSections() {
    setHiddenSections(new Set())
    if (sectionPrefsKey) {
      try {
        window.localStorage.removeItem(sectionPrefsKey)
      } catch {
        // Ignore.
      }
    }
  }

  const load = React.useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true)
      else setLoading(true)
      try {
        const [assetsRes, licensesRes, helpdeskRes, activityRes] = await Promise.all([
          canViewAssets ? apiClient.get<ApiEnvelope<AssetStats>>("/assets/stats") : null,
          canViewLicenses ? apiClient.get<ApiEnvelope<LicenseStats>>("/licenses/stats") : null,
          canViewHelpdesk
            ? apiClient.get<ApiEnvelope<HelpdeskSummary>>("/helpdesk/dashboard-summary", { params: { days } })
            : null,
          canViewAuditLogs ? apiClient.get<ApiEnvelope<{ items: ActivityEntry[] }>>("/audit-logs", { params: { limit: 7 } }) : null,
        ])
        if (assetsRes) setAssetStats(assetsRes.data.data)
        if (licensesRes) setLicenseStats(licensesRes.data.data)
        if (helpdeskRes) setHelpdeskSummary(helpdeskRes.data.data)
        if (activityRes) setActivity(activityRes.data.data.items)
        setLastUpdated(new Date())
      } catch (err) {
        toast.error(apiErrorMessage(err, "Could not load dashboard"))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [canViewAssets, canViewLicenses, canViewHelpdesk, canViewAuditLogs, days]
  )

  React.useEffect(() => {
    if (!authLoading) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canViewAssets, canViewLicenses, canViewHelpdesk, days])

  const byStatus = assetStats?.byStatus ?? {}
  const byLocation = assetStats?.byLocation ?? []
  const statusChartData = Object.entries(byStatus)
    .map(([status, count]) => ({ status, count, bucket: bucketOf(status) }))
    .sort((a, b) => b.count - a.count)
  const locationChartData = [...byLocation].sort((a, b) => b.count - a.count)
  const locationDonutTotal = locationChartData.reduce((sum, loc) => sum + loc.count, 0)
  const categoryChartData = [...(assetStats?.byCategory ?? [])].sort((a, b) => b.count - a.count)
  const departmentChartData = [...(assetStats?.byDepartment ?? [])].sort((a, b) => b.count - a.count)
  const topAssigneesData = [...(assetStats?.topAssignees ?? [])].sort((a, b) => b.count - a.count)

  const underRepairCount = byStatus["Under Repair"] ?? 0
  const warrantyExpiringCount = assetStats?.warrantyExpiringSoon ?? 0
  const licenseExpiringCount = licenseStats?.expiringSoon ?? 0
  const licenseExpiredCount = licenseStats?.expired ?? 0
  const slaBreachCount = helpdeskSummary?.slaBreaches ?? 0

  const ticketStatusChartData = Object.entries(helpdeskSummary?.byStatus ?? {}).map(([status, count]) => ({
    status,
    count,
    fill: BUCKET_COLOR[ticketBucketOf(status)],
  }))
  const ticketStatusTotal = ticketStatusChartData.reduce((sum, entry) => sum + entry.count, 0)
  const ticketCategoriesData = [...(helpdeskSummary?.topCategories ?? [])].sort((a, b) => b.count - a.count)
  const ticketTrendData = (helpdeskSummary?.trend ?? []).map((d) => ({ ...d, label: weekdayLabel(d.date) }))

  if (authLoading) return <FullPageLoader />

  if (!canViewDashboard) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  const firstName = user?.name?.split(" ")[0]

  // Only offers a toggle for a section the user actually has access to - hiding one never
  // becomes a way to "reveal" a module the org/permissions already keep off this dashboard.
  const availableSections: { key: SectionKey; label: string }[] = [
    ...(canViewAssets ? [{ key: "assets" as const, label: "Assets" }] : []),
    ...(canViewLicenses ? [{ key: "licenses" as const, label: "Licenses" }] : []),
    ...(canViewHelpdesk ? [{ key: "helpdesk" as const, label: "Helpdesk" }] : []),
    ...(canCreateAssets || canCreateTickets || canCreateTasks || canViewReports ? [{ key: "quickActions" as const, label: "Quick Actions" }] : []),
    ...(canViewAuditLogs ? [{ key: "activity" as const, label: "Recent Activity" }] : []),
  ]

  return (
    <div className="flex flex-col gap-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-[1.65rem] font-semibold tracking-tight">
            {GREETING_HOUR_MESSAGE(new Date().getHours())}{firstName ? `, ${firstName}` : ""} <span aria-hidden>👋</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {" · "}Here&apos;s what&apos;s happening with your assets and licenses.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            {canViewHelpdesk && (
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
            )}
            <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing || loading}>
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            {user?.isAdmin && availableSections.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => setCustomizeOpen(true)}>
                <Settings2 className="size-3.5" />
                Customize
              </Button>
            )}
          </div>
          {lastUpdated && <span className="text-xs text-muted-foreground">{lastUpdatedLabel(lastUpdated)}</span>}
        </div>
      </div>

      <AttentionBanner
        loading={loading}
        items={[
          { label: "assets under repair", count: underRepairCount, href: toOrgHref("/assets"), color: BUCKET_COLOR.warning },
          {
            label: "warranties expiring within 30 days",
            count: warrantyExpiringCount,
            href: toOrgHref("/assets"),
            color: BUCKET_COLOR.warning,
          },
          { label: "licenses expiring soon", count: licenseExpiringCount, href: toOrgHref("/licenses"), color: BUCKET_COLOR.warning },
          { label: "licenses expired", count: licenseExpiredCount, href: toOrgHref("/licenses"), color: BUCKET_COLOR.critical },
          { label: "tickets past SLA", count: slaBreachCount, href: toOrgHref("/helpdesk"), color: BUCKET_COLOR.critical },
        ]}
      />

      {canViewAssets && !hiddenSections.has("assets") && (
        <section className="flex flex-col gap-4">
          <SectionHeading icon={Boxes}>Assets</SectionHeading>

          {loading || !assetStats ? (
            <KpiGridSkeleton count={7} />
          ) : (
            <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
              <RevealItem><KpiCard label="Total assets" value={assetStats.total} icon={Boxes} /></RevealItem>
              <RevealItem><KpiCard label="Active assets" value={assetStats.active} icon={Activity} bucket="info" /></RevealItem>
              <RevealItem><KpiCard label="Assigned" value={byStatus["Assigned"] ?? 0} icon={UserCheck} bucket="info" /></RevealItem>
              <RevealItem>
                <KpiCard
                  label="Available"
                  value={(byStatus["Available"] ?? 0) + (byStatus["In Stock"] ?? 0)}
                  icon={CheckCircle2}
                  bucket="good"
                />
              </RevealItem>
              <RevealItem><KpiCard label="Under repair" value={byStatus["Under Repair"] ?? 0} icon={Wrench} bucket="warning" /></RevealItem>
              <RevealItem><KpiCard label="Retired" value={byStatus["Retired"] ?? 0} icon={Archive} bucket="muted" /></RevealItem>
              <RevealItem><ValueKpiCard label="Total asset value" value={assetStats.totalValue} icon={IndianRupee} /></RevealItem>
            </RevealGroup>
          )}

          {!loading && assetStats && (
            <RevealGroup className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              <RevealItem>
                <ChartCard title="Top locations" isEmpty={locationChartData.length === 0} emptyMessage="No assets assigned to a location yet.">
                  <div className="flex h-full flex-col justify-center gap-3 overflow-y-auto">
                    {locationChartData.map((loc, i) => {
                      const pct = locationDonutTotal > 0 ? Math.round((loc.count / locationDonutTotal) * 100) : 0
                      return (
                        <Link
                          key={loc.locationId}
                          href={`${toOrgHref("/assets")}?location=${encodeURIComponent(loc.name)}`}
                          className="flex flex-col gap-1 rounded-lg px-1 py-0.5 hover:bg-muted/50"
                        >
                          <div className="flex items-center justify-between gap-2 text-sm">
                            <span className="min-w-0 truncate font-medium">{loc.name}</span>
                            <span className="shrink-0 tabular-nums text-muted-foreground">{loc.count}</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, backgroundColor: LOCATION_COLORS[i % LOCATION_COLORS.length] }}
                            />
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </ChartCard>
              </RevealItem>

              <RevealItem>
                <ChartCard title="Assets by status" isEmpty={statusChartData.length === 0} emptyMessage="No assets yet.">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={statusChartData} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 4 }} barCategoryGap="30%">
                      <CartesianGrid horizontal={false} stroke={chartTheme.gridColor} />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fontSize: 12, fill: chartTheme.axisColor }}
                        axisLine={{ stroke: chartTheme.gridColor }}
                        tickLine={false}
                      />
                      <YAxis
                        dataKey="status"
                        type="category"
                        width={110}
                        tick={{ fontSize: 12, fill: chartTheme.axisColor }}
                        axisLine={{ stroke: chartTheme.gridColor }}
                        tickLine={false}
                      />
                      <Tooltip
                        content={<ChartTooltip color={(bucket) => BUCKET_COLOR[(bucket as Bucket) ?? "info"]} />}
                        cursor={{ fill: chartTheme.cursorFill }}
                      />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={MAX_BAR_SIZE} animationDuration={600} minPointSize={4}>
                        {statusChartData.map((entry) => (
                          <Cell
                            key={entry.status}
                            fill={BUCKET_COLOR[entry.bucket]}
                            className="cursor-pointer transition-opacity hover:opacity-80"
                            onClick={() => router.push(`${toOrgHref("/assets")}?status=${encodeURIComponent(entry.status)}`)}
                          />
                        ))}
                        <LabelList dataKey="count" position="right" style={{ fill: chartTheme.labelColor, fontSize: 12 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </RevealItem>

              <RevealItem>
                <ChartCard
                  title="Assets by location"
                  isEmpty={locationChartData.length === 0}
                  emptyMessage="No assets assigned to a location yet."
                >
                  <div className="flex h-full items-center gap-2">
                    <div className="relative h-full min-w-0 flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip content={<DonutTooltip />} />
                          <Pie
                            data={locationChartData}
                            dataKey="count"
                            nameKey="name"
                            innerRadius="62%"
                            outerRadius="90%"
                            paddingAngle={2}
                            strokeWidth={0}
                            animationDuration={600}
                          >
                            {locationChartData.map((entry, i) => (
                              <Cell
                                key={entry.locationId}
                                fill={LOCATION_COLORS[i % LOCATION_COLORS.length]}
                                className="cursor-pointer transition-opacity hover:opacity-80"
                                onClick={() => router.push(`${toOrgHref("/assets")}?location=${encodeURIComponent(entry.name)}`)}
                              />
                            ))}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                        <span className="text-2xl font-semibold tracking-tight tabular-nums">{locationDonutTotal}</span>
                        <span className="text-xs text-muted-foreground">Total</span>
                      </div>
                    </div>
                    <div className="flex w-32 shrink-0 flex-col gap-2 overflow-y-auto">
                      {locationChartData.map((entry, i) => {
                        const pct = locationDonutTotal > 0 ? Math.round((entry.count / locationDonutTotal) * 100) : 0
                        return (
                          <button
                            key={entry.locationId}
                            type="button"
                            onClick={() => router.push(`${toOrgHref("/assets")}?location=${encodeURIComponent(entry.name)}`)}
                            className="flex items-center gap-1.5 text-left hover:opacity-75"
                          >
                            <span
                              className="size-2 shrink-0 rounded-full"
                              style={{ backgroundColor: LOCATION_COLORS[i % LOCATION_COLORS.length] }}
                            />
                            <span className="min-w-0 flex-1 truncate text-xs text-foreground">{entry.name}</span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{pct}%</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </ChartCard>
              </RevealItem>
            </RevealGroup>
          )}

          {!loading && assetStats && (
            <RevealGroup className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <RevealItem>
                <ChartCard
                  title="Assets by category"
                  isEmpty={categoryChartData.length === 0}
                  emptyMessage="No categorized assets yet."
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryChartData} margin={{ top: 20, right: 8, bottom: 4, left: 4 }} barCategoryGap="35%">
                      <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: chartTheme.axisColor }} axisLine={{ stroke: chartTheme.gridColor }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: chartTheme.axisColor }} axisLine={{ stroke: chartTheme.gridColor }} tickLine={false} />
                      <Tooltip content={<ChartTooltip color={chartTheme.sequential} />} cursor={{ fill: chartTheme.cursorFill }} />
                      <Bar
                        dataKey="count"
                        fill={chartTheme.sequential}
                        radius={[4, 4, 0, 0]}
                        maxBarSize={MAX_BAR_SIZE}
                        animationDuration={600}
                        minPointSize={4}
                        className="transition-opacity hover:opacity-80"
                      >
                        <LabelList dataKey="count" position="top" style={{ fill: chartTheme.labelColor, fontSize: 12, fontWeight: 600 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </RevealItem>

              <RevealItem>
                <ChartCard
                  title="Assets by department"
                  isEmpty={departmentChartData.length === 0}
                  emptyMessage="No assets assigned to a department yet."
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={departmentChartData}
                      layout="vertical"
                      margin={{ top: 4, right: 32, bottom: 4, left: 4 }}
                      barCategoryGap="30%"
                    >
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
                        width={110}
                        tick={{ fontSize: 12, fill: chartTheme.axisColor }}
                        axisLine={{ stroke: chartTheme.gridColor }}
                        tickLine={false}
                      />
                      <Tooltip content={<ChartTooltip color={chartTheme.sequential} />} cursor={{ fill: chartTheme.cursorFill }} />
                      <Bar
                        dataKey="count"
                        fill={chartTheme.sequential}
                        radius={[0, 4, 4, 0]}
                        maxBarSize={MAX_BAR_SIZE}
                        animationDuration={600}
                        minPointSize={4}
                        className="transition-opacity hover:opacity-80"
                      >
                        <LabelList dataKey="count" position="right" style={{ fill: chartTheme.labelColor, fontSize: 12 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </RevealItem>
            </RevealGroup>
          )}

          {!loading && assetStats && (
            <RevealGroup>
              <RevealItem>
                <ChartCard
                  title="Top users by assigned assets"
                  isEmpty={topAssigneesData.length === 0}
                  emptyMessage="No assets assigned to a user yet."
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={topAssigneesData} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 4 }} barCategoryGap="25%">
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
                        width={140}
                        tick={{ fontSize: 12, fill: chartTheme.axisColor }}
                        axisLine={{ stroke: chartTheme.gridColor }}
                        tickLine={false}
                      />
                      <Tooltip content={<ChartTooltip color={chartTheme.sequential} />} cursor={{ fill: chartTheme.cursorFill }} />
                      <Bar
                        dataKey="count"
                        fill={chartTheme.sequential}
                        radius={[0, 4, 4, 0]}
                        maxBarSize={MAX_BAR_SIZE}
                        animationDuration={600}
                        minPointSize={4}
                        className="transition-opacity hover:opacity-80"
                      >
                        <LabelList dataKey="count" position="right" style={{ fill: chartTheme.labelColor, fontSize: 12 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </RevealItem>
            </RevealGroup>
          )}
        </section>
      )}

      {canViewLicenses && !hiddenSections.has("licenses") && (
        <section className="flex flex-col gap-4">
          <SectionHeading icon={LicenseIcon}>Licenses</SectionHeading>
          {loading || !licenseStats ? (
            <KpiGridSkeleton count={4} className="sm:grid-cols-2 md:grid-cols-4" />
          ) : (
            <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
              <RevealItem><KpiCard label="Total licenses" value={licenseStats.total} icon={KeyRound} /></RevealItem>
              <RevealItem><KpiCard label="Active licenses" value={licenseStats.active} icon={ShieldCheck} bucket="good" /></RevealItem>
              <RevealItem><KpiCard label="Expiring soon" value={licenseStats.expiringSoon} icon={AlertTriangle} bucket="warning" /></RevealItem>
              <RevealItem><KpiCard label="Expired" value={licenseStats.expired} icon={XCircle} bucket="critical" /></RevealItem>
            </RevealGroup>
          )}
        </section>
      )}

      {canViewHelpdesk && !hiddenSections.has("helpdesk") && (
        <section className="flex flex-col gap-4">
          <SectionHeading icon={TicketIcon}>Helpdesk</SectionHeading>

          {loading || !helpdeskSummary ? (
            <KpiGridSkeleton count={2} className="sm:grid-cols-2" />
          ) : (
            <RevealGroup className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <RevealItem>
                <KpiCard
                  label="Open tickets"
                  value={helpdeskSummary.open}
                  icon={TicketIcon}
                  bucket="info"
                  subtitle={
                    helpdeskSummary.newInPeriod > 0
                      ? `+${helpdeskSummary.newInPeriod} in last ${days}d`
                      : `None in last ${days}d`
                  }
                  sparkline={ticketTrendData.map((d) => d.open)}
                />
              </RevealItem>
              <RevealItem>
                <KpiCard
                  label="SLA breaches"
                  value={helpdeskSummary.slaBreaches}
                  icon={ShieldAlert}
                  bucket={helpdeskSummary.slaBreaches > 0 ? "critical" : "good"}
                  subtitle="Past due, unresolved"
                />
              </RevealItem>
            </RevealGroup>
          )}

          {!loading && helpdeskSummary && (
            <RevealGroup className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <RevealItem>
                <ChartCard title="Tickets by status" isEmpty={ticketStatusChartData.length === 0} emptyMessage="No tickets yet.">
                  <div className="flex h-full items-center gap-2">
                    <div className="relative h-full min-w-0 flex-1">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Tooltip content={<DonutTooltip />} />
                          <Pie
                            data={ticketStatusChartData}
                            dataKey="count"
                            nameKey="status"
                            innerRadius="62%"
                            outerRadius="90%"
                            paddingAngle={2}
                            strokeWidth={0}
                            animationDuration={600}
                          >
                            {ticketStatusChartData.map((entry) => (
                              <Cell
                                key={entry.status}
                                fill={entry.fill}
                                className="cursor-pointer transition-opacity hover:opacity-80"
                                onClick={() => router.push(`${toOrgHref("/helpdesk")}?status=${encodeURIComponent(entry.status)}`)}
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
                      {ticketStatusChartData.map((entry) => {
                        const pct = ticketStatusTotal > 0 ? Math.round((entry.count / ticketStatusTotal) * 100) : 0
                        return (
                          <button
                            key={entry.status}
                            type="button"
                            onClick={() => router.push(`${toOrgHref("/helpdesk")}?status=${encodeURIComponent(entry.status)}`)}
                            className="flex items-center gap-1.5 text-left hover:opacity-75"
                          >
                            <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: entry.fill }} />
                            <span className="min-w-0 flex-1 truncate text-xs text-foreground">{entry.status}</span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{pct}%</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                </ChartCard>
              </RevealItem>

              <RevealItem className="lg:col-span-2">
                <ChartCard
                  title="Tickets created this week"
                  isEmpty={ticketTrendData.every((d) => d.open + d.resolved + d.closed === 0)}
                  emptyMessage="No tickets created in the last 7 days."
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ticketTrendData} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
                      <CartesianGrid vertical={false} stroke={chartTheme.gridColor} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: chartTheme.axisColor }} axisLine={{ stroke: chartTheme.gridColor }} tickLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: chartTheme.axisColor }} axisLine={{ stroke: chartTheme.gridColor }} tickLine={false} />
                      <Tooltip content={<MultiSeriesTooltip />} cursor={{ stroke: chartTheme.gridColor }} />
                      <Line type="monotone" dataKey="open" stroke={BUCKET_COLOR.info} strokeWidth={2} dot={{ r: 3 }} animationDuration={600} />
                      <Line type="monotone" dataKey="resolved" stroke={BUCKET_COLOR.good} strokeWidth={2} dot={{ r: 3 }} animationDuration={600} />
                      <Line type="monotone" dataKey="closed" stroke={BUCKET_COLOR.muted} strokeWidth={2} dot={{ r: 3 }} animationDuration={600} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1.5">
                    {(["open", "resolved", "closed"] as const).map((key) => (
                      <span key={key} className="flex items-center gap-1.5 text-xs text-muted-foreground capitalize">
                        <span
                          className="h-2 w-3 shrink-0 rounded-full"
                          style={{ backgroundColor: BUCKET_COLOR[key === "open" ? "info" : key === "resolved" ? "good" : "muted"] }}
                        />
                        {key}
                      </span>
                    ))}
                  </div>
                </ChartCard>
              </RevealItem>
            </RevealGroup>
          )}

          {!loading && helpdeskSummary && (
            <RevealGroup>
              <RevealItem>
                <ChartCard
                  title="Top ticket categories"
                  isEmpty={ticketCategoriesData.length === 0}
                  emptyMessage="No categorized tickets yet."
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ticketCategoriesData} layout="vertical" margin={{ top: 4, right: 32, bottom: 4, left: 4 }} barCategoryGap="30%">
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
                      <Tooltip content={<ChartTooltip color={chartTheme.sequential} />} cursor={{ fill: chartTheme.cursorFill }} />
                      <Bar dataKey="count" fill={chartTheme.sequential} radius={[0, 4, 4, 0]} maxBarSize={MAX_BAR_SIZE} animationDuration={600} minPointSize={4} />
                    </BarChart>
                  </ResponsiveContainer>
                </ChartCard>
              </RevealItem>
            </RevealGroup>
          )}
        </section>
      )}

      {!canViewAssets && !canViewLicenses && !canViewHelpdesk && (
        <p className="text-sm text-muted-foreground">You don&apos;t have access to any dashboard data yet.</p>
      )}

      {(canViewAuditLogs || canViewHelpdesk) && !hiddenSections.has("activity") && (
        <section className="flex flex-col gap-4">
          <SectionHeading icon={History}>Activity &amp; Insights</SectionHeading>
          <RevealGroup className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {canViewAuditLogs && (
              <RevealItem className="h-[220px] sm:h-[260px] lg:h-[320px]">
                <div className="flex h-full flex-col gap-3 rounded-xl border bg-card p-5 shadow-soft-sm">
                  <SectionHeading icon={History}>Recent Activity</SectionHeading>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {loading ? <ActivityFeedSkeleton /> : <ActivityFeed entries={activity} />}
                  </div>
                </div>
              </RevealItem>
            )}
            {canViewHelpdesk && helpdeskSummary && (
              <RevealItem className="h-[220px] sm:h-[260px] lg:h-[320px]">
                <TicketInsightsCard insights={helpdeskSummary.insights} />
              </RevealItem>
            )}
            {canViewHelpdesk && helpdeskSummary && (
              <RevealItem className="h-[220px] sm:h-[260px] lg:h-[320px]">
                <TicketAlertsCard alerts={helpdeskSummary.alerts} hrefForAlert={(alert) => toOrgHref(`/helpdesk/${alert.id}`)} />
              </RevealItem>
            )}
          </RevealGroup>
        </section>
      )}

      {(canCreateAssets || canCreateTickets || canCreateTasks || canViewReports) && !hiddenSections.has("quickActions") && (
        <section className="flex flex-col gap-4">
          <SectionHeading icon={Tags}>Quick Actions</SectionHeading>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {canCreateAssets && (
              <Link
                href={toOrgHref("/assets/add")}
                className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-soft-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-md"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Boxes className="size-4.5" />
                </span>
                <span className="text-sm font-medium">Add Asset</span>
              </Link>
            )}
            {canCreateTickets && (
              <Link
                href={toOrgHref("/helpdesk/add")}
                className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-soft-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-md"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info/10 text-info">
                  <TicketIcon className="size-4.5" />
                </span>
                <span className="text-sm font-medium">Create Ticket</span>
              </Link>
            )}
            {canCreateTasks && (
              <Link
                href={toOrgHref("/tasks/add")}
                className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-soft-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-md"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-success/10 text-success">
                  <ListChecks className="size-4.5" />
                </span>
                <span className="text-sm font-medium">Add Task</span>
              </Link>
            )}
            {canViewReports && (
              <Link
                href={toOrgHref("/reports")}
                className="group flex items-center gap-3 rounded-xl border bg-card p-4 shadow-soft-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-soft-md"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-warning-foreground">
                  <BarChart3 className="size-4.5" />
                </span>
                <span className="text-sm font-medium">Generate Report</span>
              </Link>
            )}
          </div>
        </section>
      )}

      {!loading && availableSections.length > 0 && hiddenSections.size >= availableSections.length && (
        <p className="text-sm text-muted-foreground">
          Every section is hidden. Open Customize to bring one back, or Reset to default.
        </p>
      )}

      <Sheet open={customizeOpen} onOpenChange={setCustomizeOpen}>
        <SheetContent side="right" className="w-full sm:max-w-sm">
          <SheetHeader>
            <SheetTitle>Customize dashboard</SheetTitle>
            <SheetDescription>Choose which sections to show. Saved automatically for you.</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4">
            {availableSections.map((section) => (
              <label
                key={section.key}
                className="flex cursor-pointer items-center gap-2.5 rounded-lg border p-3 text-sm hover:bg-muted/50"
              >
                <Checkbox
                  checked={!hiddenSections.has(section.key)}
                  onCheckedChange={(checked) => toggleSection(section.key, checked === true)}
                />
                {section.label}
              </label>
            ))}
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={resetSections} className="gap-1.5">
              <RotateCcw className="size-3.5" />
              Reset to default
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  )
}
