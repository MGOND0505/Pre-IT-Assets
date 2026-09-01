"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiClient, apiErrorMessage, orgScopedApiUrl, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"

type Classification = "new" | "updated" | "duplicate" | "invalid"
type LicenseMode = "catalog" | "per-user"

type MappedRow = {
  rowIndex: number
  mapped: Record<string, string>
  classification: Classification
  reason?: string
}

type MappedGroup = {
  softwareName: string
  seatCount: number
  emails: string[]
  resolvedUserIds: string[]
  unresolvedEmails: string[]
  classification: Classification
  reason?: string
}

type PreviewResult = {
  mode: LicenseMode
  counts: { total: number; new: number; updated: number; duplicate: number; invalid: number }
  rows?: MappedRow[]
  groups?: MappedGroup[]
}

type ConfirmResult = { total: number; added: number; updated: number; duplicates: number; invalid: number; errors: string[] }

const BADGE_VARIANT: Record<Classification, "default" | "secondary" | "outline" | "destructive"> = {
  new: "default",
  updated: "outline",
  duplicate: "secondary",
  invalid: "destructive",
}

const TARGETS = [
  { value: "assets", label: "Assets" },
  { value: "licenses", label: "Licenses" },
  { value: "users", label: "Users" },
  { value: "vendors", label: "Vendors" },
] as const

type UploadTarget = (typeof TARGETS)[number]["value"]

function isValidTarget(value: string | null): value is UploadTarget {
  return TARGETS.some((t) => t.value === value)
}

export default function UploadDataPage() {
  const { user, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  // Seeds the initial target from a deep link like /upload?target=users (the User Management
  // nav group's "Bulk Upload" entry) - not a visible filter control, just a starting selection.
  const initialTarget = searchParams.get("target")
  const [target, setTarget] = React.useState<UploadTarget>(isValidTarget(initialTarget) ? initialTarget : "assets")
  const [licenseMode, setLicenseMode] = React.useState<LicenseMode>("catalog")
  const [file, setFile] = React.useState<File | null>(null)
  const [previewing, setPreviewing] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)
  const [preview, setPreview] = React.useState<PreviewResult | null>(null)
  const [result, setResult] = React.useState<ConfirmResult | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Users import has no separate permission action (deliberately - see users.routes.ts's own
  // comment on why bulk creation stays Admin-only, same as single-user creation) so it's gated by
  // isAdmin directly rather than can(user,"users","import"), which doesn't exist.
  const canUpload =
    can(user, "assets", "import") ||
    can(user, "licenses", "import") ||
    can(user, "vendors", "import") ||
    Boolean(user?.isAdmin)

  function reset() {
    setFile(null)
    setPreview(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  function handleDownloadCurrentData() {
    window.open(orgScopedApiUrl(`/reports/${target}/export?format=csv`), "_blank")
  }

  function handleDownloadTemplate() {
    window.open(orgScopedApiUrl(`/${target}/import/template`), "_blank")
  }

  async function handlePreview() {
    if (!file) {
      toast.error("Choose a CSV or Excel file first")
      return
    }
    setPreviewing(true)
    setResult(null)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const query = target === "licenses" ? `?mode=${licenseMode}` : ""
      const res = await apiClient.post<ApiEnvelope<PreviewResult>>(`/${target}/import/preview${query}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      setPreview(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not preview the file"))
    } finally {
      setPreviewing(false)
    }
  }

  async function handleConfirm() {
    if (!preview) return
    setConfirming(true)
    try {
      const body =
        preview.mode === "per-user"
          ? { mode: "per-user", groups: preview.groups }
          : { mode: "catalog", rows: preview.rows }
      const res = await apiClient.post<ApiEnvelope<ConfirmResult>>(`/${target}/import/confirm`, body)
      setResult(res.data.data)
      const r = res.data.data
      toast.success(`${r.total} total | ${r.added} added | ${r.updated} updated | ${r.duplicates} duplicates | ${r.errors.length} errors`)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not import the file"))
    } finally {
      setConfirming(false)
    }
  }

  if (authLoading) return null
  if (!canUpload) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  const rows = preview?.rows ?? []
  const groups = preview?.groups ?? []
  const mappedColumns = rows.length > 0 ? Object.keys(rows[0].mapped) : []
  const importableCount = (preview?.counts.new ?? 0) + (preview?.counts.updated ?? 0)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload Data</h1>
        <p className="text-sm text-muted-foreground">
          CSV/Excel is the primary way to bring data in and out. Upload a file to add new records and update
          existing ones (matched by ID/serial/software name) - nothing is saved until you review and confirm.
        </p>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">1. Choose target &amp; file</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={target}
              onValueChange={(v) => {
                setTarget((v as UploadTarget) ?? "assets")
                reset()
              }}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TARGETS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {target === "licenses" && (
              <Select
                value={licenseMode}
                onValueChange={(v) => {
                  setLicenseMode((v as LicenseMode) ?? "catalog")
                  reset()
                }}
              >
                <SelectTrigger className="w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="catalog">One row per license (catalog)</SelectItem>
                  <SelectItem value="per-user">One row per user (seat assignment export)</SelectItem>
                </SelectContent>
              </Select>
            )}

            {target !== "users" && target !== "vendors" && (
              <Button variant="outline" onClick={handleDownloadCurrentData}>
                Download current data (CSV)
              </Button>
            )}
            <Button variant="outline" onClick={handleDownloadTemplate}>
              Download template (CSV)
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null)
                setPreview(null)
                setResult(null)
              }}
              className="text-sm"
            />
            <Button onClick={handlePreview} disabled={!file || previewing}>
              {previewing ? "Analyzing..." : "Preview"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            You don&apos;t need to upload the full dataset every time - a file with just the new or changed rows is
            enough. Rows matched to an existing record (by ID, serial number, IMEI, or software name) are updated;
            unmatched rows are added; unchanged rows are skipped as duplicates.
          </p>
        </CardContent>
      </Card>

      {preview && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Review &amp; confirm</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-3">
              <Badge variant="outline">Total: {preview.counts.total}</Badge>
              <Badge>New: {preview.counts.new}</Badge>
              <Badge variant="outline">Updated: {preview.counts.updated}</Badge>
              <Badge variant="secondary">Duplicate: {preview.counts.duplicate}</Badge>
              <Badge variant="destructive">Invalid: {preview.counts.invalid}</Badge>
            </div>

            <div className="max-h-96 overflow-auto rounded-md border">
              <Table>
                {preview.mode === "per-user" ? (
                  <>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Status</TableHead>
                        <TableHead>Software</TableHead>
                        <TableHead>Seats</TableHead>
                        <TableHead>Matched users</TableHead>
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groups.map((group) => (
                        <TableRow key={group.softwareName}>
                          <TableCell>
                            <Badge variant={BADGE_VARIANT[group.classification]}>{group.classification}</Badge>
                          </TableCell>
                          <TableCell>{group.softwareName}</TableCell>
                          <TableCell>{group.seatCount}</TableCell>
                          <TableCell>
                            {group.resolvedUserIds.length} / {group.emails.length}
                          </TableCell>
                          <TableCell className="max-w-60 text-xs text-muted-foreground">
                            {group.reason ?? "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </>
                ) : (
                  <>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Status</TableHead>
                        {mappedColumns.slice(0, 5).map((col) => (
                          <TableHead key={col}>{col}</TableHead>
                        ))}
                        <TableHead>Reason</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rows.map((row) => (
                        <TableRow key={row.rowIndex}>
                          <TableCell>{row.rowIndex + 1}</TableCell>
                          <TableCell>
                            <Badge variant={BADGE_VARIANT[row.classification]}>{row.classification}</Badge>
                          </TableCell>
                          {mappedColumns.slice(0, 5).map((col) => (
                            <TableCell key={col} className="max-w-40 truncate">
                              {row.mapped[col]}
                            </TableCell>
                          ))}
                          <TableCell className="max-w-60 text-xs text-muted-foreground">{row.reason ?? "-"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </>
                )}
              </Table>
            </div>

            <p className="text-sm text-muted-foreground">
              {preview.counts.new} new + {preview.counts.updated} updated ={" "}
              <strong>{importableCount}</strong> row(s) will be applied. Duplicates (no change) and invalid rows are
              skipped automatically.
            </p>

            <div className="flex gap-2">
              <Button onClick={handleConfirm} disabled={confirming || importableCount === 0}>
                {confirming ? "Importing..." : `Confirm import (${importableCount})`}
              </Button>
              <Button variant="outline" onClick={reset}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle className="text-base">Import complete</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p className="text-base font-medium">
              {result.total} total | {result.added} added | {result.updated} updated | {result.duplicates} duplicates |{" "}
              {result.errors.length} errors
            </p>
            {result.invalid > 0 && <p className="text-muted-foreground">{result.invalid} row(s) were invalid and skipped.</p>}
            {result.errors.length > 0 && (
              <div className="flex flex-col gap-1 text-destructive">
                {result.errors.map((e, i) => (
                  <span key={i}>{e}</span>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
