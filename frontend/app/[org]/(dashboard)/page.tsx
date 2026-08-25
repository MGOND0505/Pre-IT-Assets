"use client"

import * as React from "react"
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
import {
  AlertTriangle,
  Archive,
  Boxes,
  CheckCircle2,
  IndianRupee,
  KeyRound,
  MapPin,
  ShieldCheck,
  UserCheck,
  Wrench,
  XCircle,
  Activity,
  KeyRound as LicenseIcon,
  History,
  RefreshCw,
} from "lucide-react"

import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"
import { Button } from "@/components/ui/button"
import { KpiCard, ValueKpiCard, KpiGridSkeleton, BUCKET_COLOR, type Bucket } from "@/components/dashboard/kpi-card"
import { ChartCard, ChartTooltip, useChartTheme } from "@/components/dashboard/chart-card"
import { SectionHeading } from "@/components/dashboard/section-heading"
import { AttentionBanner } from "@/components/dashboard/attention-banner"
import { ActivityFeed, ActivityFeedSkeleton, type ActivityEntry } from "@/components/dashboard/activity-feed"
import { RevealGroup, RevealItem } from "@/components/dashboard/reveal"

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

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const toOrgHref = useOrgHref()
  const chartTheme = useChartTheme()
  const [assetStats, setAssetStats] = React.useState<AssetStats | null>(null)
  const [licenseStats, setLicenseStats] = React.useState<LicenseStats | null>(null)
  const [activity, setActivity] = React.useState<ActivityEntry[]>([])
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null)

  const canViewAssets = can(user, "assets", "view")
  const canViewLicenses = can(user, "licenses", "view")
  const canViewDashboard = can(user, "dashboard", "view")
  const canViewAuditLogs = can(user, "auditLogs", "view")

  const load = React.useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true)
      else setLoading(true)
      try {
        const [assetsRes, licensesRes, activityRes] = await Promise.all([
          canViewAssets ? apiClient.get<ApiEnvelope<AssetStats>>("/assets/stats") : null,
          canViewLicenses ? apiClient.get<ApiEnvelope<LicenseStats>>("/licenses/stats") : null,
          canViewAuditLogs ? apiClient.get<ApiEnvelope<{ items: ActivityEntry[] }>>("/audit-logs", { params: { limit: 7 } }) : null,
        ])
        if (assetsRes) setAssetStats(assetsRes.data.data)
        if (licensesRes) setLicenseStats(licensesRes.data.data)
        if (activityRes) setActivity(activityRes.data.data.items)
        setLastUpdated(new Date())
      } catch (err) {
        toast.error(apiErrorMessage(err, "Could not load dashboard"))
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [canViewAssets, canViewLicenses, canViewAuditLogs]
  )

  React.useEffect(() => {
    if (!authLoading) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, canViewAssets, canViewLicenses])

  const byStatus = assetStats?.byStatus ?? {}
  const byLocation = assetStats?.byLocation ?? []
  const statusChartData = Object.entries(byStatus)
    .map(([status, count]) => ({ status, count, bucket: bucketOf(status) }))
    .sort((a, b) => b.count - a.count)
  const locationChartData = [...byLocation].sort((a, b) => b.count - a.count)
  const categoryChartData = [...(assetStats?.byCategory ?? [])].sort((a, b) => b.count - a.count)
  const departmentChartData = [...(assetStats?.byDepartment ?? [])].sort((a, b) => b.count - a.count)
  const topAssigneesData = [...(assetStats?.topAssignees ?? [])].sort((a, b) => b.count - a.count)

  const underRepairCount = byStatus["Under Repair"] ?? 0
  const warrantyExpiringCount = assetStats?.warrantyExpiringSoon ?? 0
  const licenseExpiringCount = licenseStats?.expiringSoon ?? 0
  const licenseExpiredCount = licenseStats?.expired ?? 0

  if (authLoading) return null

  if (!canViewDashboard) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  const firstName = user?.name?.split(" ")[0]

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[1.65rem] font-semibold tracking-tight">
            {GREETING_HOUR_MESSAGE(new Date().getHours())}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            {" · "}Here&apos;s what&apos;s happening with your assets and licenses.
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing || loading}>
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          {lastUpdated && <span className="text-xs text-muted-foreground">{lastUpdatedLabel(lastUpdated)}</span>}
        </div>
      </div>

      <AttentionBanner
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
        ]}
      />

      {canViewAssets && (
        <section className="flex flex-col gap-4">
          <SectionHeading icon={Boxes}>Assets</SectionHeading>

          {loading || !assetStats ? (
            <KpiGridSkeleton count={9} />
          ) : (
            <RevealGroup className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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
              {locationChartData.slice(0, 2).map((loc) => (
                <RevealItem key={loc.locationId}>
                  <KpiCard label={loc.name} value={loc.count} icon={MapPin} />
                </RevealItem>
              ))}
              <RevealItem><ValueKpiCard label="Total asset value" value={assetStats.totalValue} icon={IndianRupee} /></RevealItem>
            </RevealGroup>
          )}

          {!loading && assetStats && (
            <RevealGroup className="grid grid-cols-1 gap-4 lg:grid-cols-2">
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
                      <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={MAX_BAR_SIZE} animationDuration={600}>
                        {statusChartData.map((entry) => (
                          <Cell
                            key={entry.status}
                            fill={BUCKET_COLOR[entry.bucket]}
                            className="transition-opacity hover:opacity-80"
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
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={locationChartData} margin={{ top: 20, right: 8, bottom: 4, left: 4 }} barCategoryGap="35%">
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
                        className="transition-opacity hover:opacity-80"
                      >
                        <LabelList dataKey="count" position="top" style={{ fill: chartTheme.labelColor, fontSize: 12, fontWeight: 600 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
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

      {canViewLicenses && (
        <section className="flex flex-col gap-4">
          <SectionHeading icon={LicenseIcon}>Licenses</SectionHeading>
          {loading || !licenseStats ? (
            <KpiGridSkeleton count={4} className="md:grid-cols-4 lg:grid-cols-4" />
          ) : (
            <RevealGroup className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <RevealItem><KpiCard label="Total licenses" value={licenseStats.total} icon={KeyRound} /></RevealItem>
              <RevealItem><KpiCard label="Active licenses" value={licenseStats.active} icon={ShieldCheck} bucket="good" /></RevealItem>
              <RevealItem><KpiCard label="Expiring soon" value={licenseStats.expiringSoon} icon={AlertTriangle} bucket="warning" /></RevealItem>
              <RevealItem><KpiCard label="Expired" value={licenseStats.expired} icon={XCircle} bucket="critical" /></RevealItem>
            </RevealGroup>
          )}
        </section>
      )}

      {!canViewAssets && !canViewLicenses && (
        <p className="text-sm text-muted-foreground">You don&apos;t have access to any dashboard data yet.</p>
      )}

      {canViewAuditLogs && (
        <section className="flex flex-col gap-4">
          <SectionHeading icon={History}>Recent Activity</SectionHeading>
          <div className="rounded-xl bg-card py-4 text-sm text-card-foreground shadow-soft-sm ring-1 ring-foreground/10">
            <div className="px-4">
              {loading ? <ActivityFeedSkeleton /> : <ActivityFeed entries={activity} />}
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
