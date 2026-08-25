"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiClient, apiErrorMessage, orgScopedApiUrl, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"

type AssetRow = {
  assetId: string
  name: string
  category: string
  manufacturer: string
  model: string
  serialNumber: string
  status: string
  location: string
  department: string
  vendor: string
  employeeName: string
  employeeEmail: string
  purchaseDate: string
  warrantyEnd: string
}

type LicenseRow = {
  licenseId: string
  softwareName: string
  vendor: string
  department: string
  totalLicenses: number
  usedLicenses: number
  availableLicenses: number
  status: string
  expiryDate: string
  daysRemaining: number | ""
}

type ReportKey =
  | "asset-register"
  | "assets-by-employee"
  | "assets-by-department"
  | "assets-by-location"
  | "asset-status"
  | "warranty"
  | "license-register"
  | "license-expiry"

const ASSET_REPORTS: { key: ReportKey; label: string }[] = [
  { key: "asset-register", label: "Complete Asset Report" },
  { key: "assets-by-employee", label: "Employee-wise Assets" },
  { key: "assets-by-department", label: "Department-wise Assets" },
  { key: "assets-by-location", label: "Location-wise Assets" },
  { key: "asset-status", label: "Asset Status Report" },
  { key: "warranty", label: "Warranty Report" },
]

const LICENSE_REPORTS: { key: ReportKey; label: string }[] = [
  { key: "license-register", label: "License Report" },
  { key: "license-expiry", label: "License Expiry Report" },
]

const ASSET_COLUMNS: { key: keyof AssetRow; label: string }[] = [
  { key: "assetId", label: "Asset ID" },
  { key: "name", label: "Name" },
  { key: "category", label: "Category" },
  { key: "status", label: "Status" },
  { key: "location", label: "Location" },
  { key: "department", label: "Department" },
  { key: "employeeName", label: "Employee" },
  { key: "warrantyEnd", label: "Warranty End" },
]

const LICENSE_COLUMNS: { key: keyof LicenseRow; label: string }[] = [
  { key: "licenseId", label: "License ID" },
  { key: "softwareName", label: "Software" },
  { key: "vendor", label: "Vendor" },
  { key: "totalLicenses", label: "Total" },
  { key: "usedLicenses", label: "Used" },
  { key: "availableLicenses", label: "Available" },
  { key: "status", label: "Status" },
  { key: "expiryDate", label: "Expiry" },
  { key: "daysRemaining", label: "Days Left" },
]

function sortAssets(rows: AssetRow[], reportKey: ReportKey): AssetRow[] {
  const copy = [...rows]
  if (reportKey === "assets-by-employee") return copy.sort((a, b) => a.employeeName.localeCompare(b.employeeName))
  if (reportKey === "assets-by-department") return copy.sort((a, b) => a.department.localeCompare(b.department))
  if (reportKey === "assets-by-location") return copy.sort((a, b) => a.location.localeCompare(b.location))
  if (reportKey === "asset-status") return copy.sort((a, b) => a.status.localeCompare(b.status))
  if (reportKey === "warranty") {
    return copy.filter((a) => a.warrantyEnd).sort((a, b) => a.warrantyEnd.localeCompare(b.warrantyEnd))
  }
  return copy
}

export default function ReportsPage() {
  const { user, loading: authLoading } = useAuth()
  const [reportKey, setReportKey] = React.useState<ReportKey>("asset-register")
  const [assetRows, setAssetRows] = React.useState<AssetRow[]>([])
  const [licenseRows, setLicenseRows] = React.useState<LicenseRow[]>([])
  const [loading, setLoading] = React.useState(true)

  const canViewAssets = can(user, "reports", "view") && can(user, "assets", "view")
  const canViewLicenses = can(user, "reports", "view") && can(user, "licenses", "view")
  // Export is gated by the exported resource's own permission, not by reports:view alone -
  // a view-only Team Member shouldn't see an Export button that would just 403 on click.
  const canExportAssets = can(user, "assets", "export")
  const canExportLicenses = can(user, "licenses", "export")
  const isLicenseReport = reportKey === "license-register" || reportKey === "license-expiry"
  const canExportCurrentReport = isLicenseReport ? canExportLicenses : canExportAssets

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      if (isLicenseReport) {
        const res = await apiClient.get<ApiEnvelope<LicenseRow[]>>("/reports/licenses")
        setLicenseRows(res.data.data)
      } else {
        const res = await apiClient.get<ApiEnvelope<AssetRow[]>>("/reports/assets")
        setAssetRows(res.data.data)
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load report"))
    } finally {
      setLoading(false)
    }
  }, [isLicenseReport])

  React.useEffect(() => {
    load()
  }, [load])

  function handleExport(format: "csv" | "excel" | "pdf") {
    const path = isLicenseReport ? "/reports/licenses/export" : "/reports/assets/export"
    window.open(orgScopedApiUrl(`${path}?format=${format}`), "_blank")
  }

  if (authLoading) return null
  if (!canViewAssets && !canViewLicenses) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  const displayedAssetRows = sortAssets(assetRows, reportKey)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-sm text-muted-foreground">View and export asset and license reports.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select a report</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Select value={reportKey} onValueChange={(v) => setReportKey((v as ReportKey) ?? "asset-register")}>
            <SelectTrigger className="w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {canViewAssets &&
                ASSET_REPORTS.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.label}
                  </SelectItem>
                ))}
              {canViewLicenses &&
                LICENSE_REPORTS.map((r) => (
                  <SelectItem key={r.key} value={r.key}>
                    {r.label}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          {canExportCurrentReport && (
            <>
              <Button variant="outline" onClick={() => handleExport("csv")}>
                Export CSV
              </Button>
              <Button variant="outline" onClick={() => handleExport("excel")}>
                Export Excel
              </Button>
              <Button variant="outline" onClick={() => handleExport("pdf")}>
                Export PDF
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {(isLicenseReport ? LICENSE_COLUMNS : ASSET_COLUMNS).map((col) => (
                <TableHead key={String(col.key)}>{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={isLicenseReport ? LICENSE_COLUMNS.length : ASSET_COLUMNS.length} className="h-24 text-center text-muted-foreground">
                  Loading...
                </TableCell>
              </TableRow>
            ) : isLicenseReport ? (
              licenseRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={LICENSE_COLUMNS.length} className="h-24 text-center text-muted-foreground">
                    No records found.
                  </TableCell>
                </TableRow>
              ) : (
                licenseRows.map((row) => (
                  <TableRow key={row.licenseId}>
                    {LICENSE_COLUMNS.map((col) => (
                      <TableCell key={String(col.key)}>{row[col.key]}</TableCell>
                    ))}
                  </TableRow>
                ))
              )
            ) : displayedAssetRows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={ASSET_COLUMNS.length} className="h-24 text-center text-muted-foreground">
                  No records found.
                </TableCell>
              </TableRow>
            ) : (
              displayedAssetRows.map((row) => (
                <TableRow key={row.assetId}>
                  {ASSET_COLUMNS.map((col) => (
                    <TableCell key={String(col.key)}>{row[col.key]}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
