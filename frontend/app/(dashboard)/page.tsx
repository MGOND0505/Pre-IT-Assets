"use client"

import * as React from "react"
import { toast } from "sonner"
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"

type AssetStats = {
  total: number
  byStatus: Record<string, number>
  byLocation: { locationId: string; name: string; count: number }[]
}

type LicenseStats = {
  total: number
  active: number
  expiringSoon: number
  expired: number
}

function KpiCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-1 pt-6">
        <span className="text-sm text-muted-foreground">{label}</span>
        <span className="text-2xl font-semibold tracking-tight">{value}</span>
      </CardContent>
    </Card>
  )
}

function findLocationCount(byLocation: AssetStats["byLocation"], name: string) {
  const match = byLocation.find((l) => l.name.toLowerCase().includes(name.toLowerCase()))
  return match?.count ?? 0
}

const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#0ea5e9", "#a855f7", "#64748b"]

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth()
  const [assetStats, setAssetStats] = React.useState<AssetStats | null>(null)
  const [licenseStats, setLicenseStats] = React.useState<LicenseStats | null>(null)
  const [loading, setLoading] = React.useState(true)

  const canViewAssets = can(user, "assets", "read")
  const canViewLicenses = can(user, "licenses", "read")

  React.useEffect(() => {
    async function load() {
      setLoading(true)
      try {
        const [assetsRes, licensesRes] = await Promise.all([
          canViewAssets ? apiClient.get<ApiEnvelope<AssetStats>>("/assets/stats") : null,
          canViewLicenses ? apiClient.get<ApiEnvelope<LicenseStats>>("/licenses/stats") : null,
        ])
        if (assetsRes) setAssetStats(assetsRes.data.data)
        if (licensesRes) setLicenseStats(licensesRes.data.data)
      } catch (err) {
        toast.error(apiErrorMessage(err, "Could not load dashboard"))
      } finally {
        setLoading(false)
      }
    }
    if (!authLoading) load()
  }, [authLoading, canViewAssets, canViewLicenses])

  if (authLoading || loading) return null

  const byStatus = assetStats?.byStatus ?? {}
  const byLocation = assetStats?.byLocation ?? []
  const statusChartData = Object.entries(byStatus).map(([status, count]) => ({ status, count }))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">A quick overview of assets and licenses.</p>
      </div>

      {canViewAssets && assetStats && (
        <>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
            <KpiCard label="Total Assets" value={assetStats.total} />
            <KpiCard label="Delhi" value={findLocationCount(byLocation, "delhi")} />
            <KpiCard label="Goa" value={findLocationCount(byLocation, "goa")} />
            <KpiCard label="Assigned" value={byStatus["Assigned"] ?? 0} />
            <KpiCard label="Available" value={byStatus["Available"] ?? 0} />
            <KpiCard label="Under Repair" value={byStatus["Under Repair"] ?? 0} />
            <KpiCard label="Retired" value={byStatus["Retired"] ?? 0} />
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assets by status</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {statusChartData.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No assets yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusChartData} dataKey="count" nameKey="status" outerRadius={90} label>
                        {statusChartData.map((entry, i) => (
                          <Cell key={entry.status} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assets by location</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                {byLocation.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No assets assigned to a location yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={byLocation}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {canViewLicenses && licenseStats && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <KpiCard label="Total Licenses" value={licenseStats.total} />
          <KpiCard label="Active Licenses" value={licenseStats.active} />
          <KpiCard label="Expiring Soon" value={licenseStats.expiringSoon} />
          <KpiCard label="Expired" value={licenseStats.expired} />
        </div>
      )}

      {!canViewAssets && !canViewLicenses && (
        <p className="text-sm text-muted-foreground">You don&apos;t have access to any dashboard data yet.</p>
      )}
    </div>
  )
}
