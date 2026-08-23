"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"

type Classification = "new" | "duplicate" | "invalid"
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
  counts: { total: number; new: number; duplicate: number; invalid: number }
  rows?: MappedRow[]
  groups?: MappedGroup[]
}

type ConfirmResult = { created: number; skipped: number; errors: string[] }

const BADGE_VARIANT: Record<Classification, "default" | "secondary" | "destructive"> = {
  new: "default",
  duplicate: "secondary",
  invalid: "destructive",
}

const TARGETS = [
  { value: "assets", label: "Assets" },
  { value: "licenses", label: "Licenses" },
] as const

export default function UploadDataPage() {
  const { user, loading: authLoading } = useAuth()
  const [target, setTarget] = React.useState<"assets" | "licenses">("assets")
  const [licenseMode, setLicenseMode] = React.useState<LicenseMode>("catalog")
  const [file, setFile] = React.useState<File | null>(null)
  const [previewing, setPreviewing] = React.useState(false)
  const [confirming, setConfirming] = React.useState(false)
  const [preview, setPreview] = React.useState<PreviewResult | null>(null)
  const [result, setResult] = React.useState<ConfirmResult | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const canUpload = can(user, "assets", "add") || can(user, "licenses", "add")

  function reset() {
    setFile(null)
    setPreview(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ""
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
      toast.success(`Imported ${res.data.data.created} record(s)`)
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

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upload Data</h1>
        <p className="text-sm text-muted-foreground">
          Import assets or licenses from a CSV/Excel file. Nothing is saved until you review and confirm.
        </p>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">1. Choose file</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Select
            value={target}
            onValueChange={(v) => {
              setTarget((v as "assets" | "licenses") ?? "assets")
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
              Only the {preview.counts.new} row(s) marked <strong>new</strong> will be imported. Duplicates and
              invalid rows are skipped automatically.
            </p>

            <div className="flex gap-2">
              <Button onClick={handleConfirm} disabled={confirming || preview.counts.new === 0}>
                {confirming ? "Importing..." : `Confirm import (${preview.counts.new})`}
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
            <p>{result.created} record(s) created.</p>
            <p>{result.skipped} record(s) skipped (duplicate or invalid).</p>
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
