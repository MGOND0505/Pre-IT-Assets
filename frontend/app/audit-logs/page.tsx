"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { RefreshCw, ScrollText, KeyRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/common/data-table"
import { Pagination } from "@/components/common/pagination"
import { SuperAdminShell } from "@/components/layout/super-admin-shell"
import { FullPageLoader } from "@/components/layout/full-page-loader"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"

type OrgRef = { _id: string; name: string; slug: string } | null

type AuditLogItem = {
  _id: string
  organization: OrgRef
  userSnapshot: { name: string | null; email: string | null; role: string | null }
  action: string
  module: string
  recordLabel: string | null
  createdAt: string
}

type LoginHistoryItem = {
  _id: string
  organization: OrgRef
  emailAttempted: string
  action: "login_success" | "login_failed" | "logout"
  reason: string | null
  ipAddress: string | null
  createdAt: string
}

type Paginated<T> = { items: T[]; total: number; page: number; totalPages: number }

type OrgListItem = { _id: string; name: string; slug: string }

const LOGIN_ACTION_LABEL: Record<LoginHistoryItem["action"], string> = {
  login_success: "Success",
  login_failed: "Failed",
  logout: "Logout",
}

const LOGIN_ACTION_VARIANT: Record<LoginHistoryItem["action"], "success" | "destructive" | "outline"> = {
  login_success: "success",
  login_failed: "destructive",
  logout: "outline",
}

function OrgCell({ organization }: { organization: OrgRef }) {
  return organization ? (
    <span>{organization.name}</span>
  ) : (
    <Badge variant="outline">Platform</Badge>
  )
}

/**
 * The Super Admin panel's flat, cross-organization audit viewer - the 3rd new flat page this
 * session (after /users and /system-monitoring), same guard/shell/fetch-on-mount pattern. Unlike
 * every org's own Administration > Audit Logs (scoped to just that org), this spans every
 * organization at once PLUS the null-organization platform-level entries (PlatformSettings
 * changes, superAdmin's own org-agnostic login flow) that no org-scoped view could ever show.
 * Two stacked sections rather than tabs (no Tabs primitive in this app yet) - Activity Log and
 * Login History, each independently paginated with its own optional organization filter.
 */
export default function GlobalAuditLogsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()

  const [orgs, setOrgs] = React.useState<OrgListItem[]>([])

  const [auditData, setAuditData] = React.useState<Paginated<AuditLogItem> | null>(null)
  const [auditLoading, setAuditLoading] = React.useState(true)
  const [auditPage, setAuditPage] = React.useState(1)
  const [auditOrgId, setAuditOrgId] = React.useState<string>("all")

  const [loginData, setLoginData] = React.useState<Paginated<LoginHistoryItem> | null>(null)
  const [loginLoading, setLoginLoading] = React.useState(true)
  const [loginPage, setLoginPage] = React.useState(1)
  const [loginOrgId, setLoginOrgId] = React.useState<string>("all")

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
      .get<ApiEnvelope<{ items: OrgListItem[] }>>("/organizations", { params: { limit: 500 } })
      .then((res) => setOrgs(res.data.data.items))
      .catch(() => setOrgs([]))
  }, [user])

  const loadAudit = React.useCallback(async () => {
    setAuditLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Paginated<AuditLogItem>>>("/audit-logs", {
        params: { page: auditPage, limit: 10, organizationId: auditOrgId === "all" ? undefined : auditOrgId },
      })
      setAuditData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load activity log"))
    } finally {
      setAuditLoading(false)
    }
  }, [auditPage, auditOrgId])

  const loadLogins = React.useCallback(async () => {
    setLoginLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Paginated<LoginHistoryItem>>>("/audit-logs/login-history", {
        params: { page: loginPage, limit: 10, organizationId: loginOrgId === "all" ? undefined : loginOrgId },
      })
      setLoginData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load login history"))
    } finally {
      setLoginLoading(false)
    }
  }, [loginPage, loginOrgId])

  React.useEffect(() => {
    if (user?.role === "superAdmin") loadAudit()
  }, [user, loadAudit])

  React.useEffect(() => {
    if (user?.role === "superAdmin") loadLogins()
  }, [user, loadLogins])

  if (authLoading || !user || user.role !== "superAdmin") return <FullPageLoader />

  const auditColumns: ColumnDef<AuditLogItem, unknown>[] = [
    { id: "org", header: "Organization", cell: ({ row }) => <OrgCell organization={row.original.organization} /> },
    { id: "action", header: "Action", cell: ({ row }) => <Badge variant="outline">{row.original.action}</Badge> },
    { accessorKey: "module", header: "Module" },
    {
      id: "user",
      header: "User",
      cell: ({ row }) => row.original.userSnapshot.name ?? row.original.userSnapshot.email ?? "-",
    },
    { id: "record", header: "Record", cell: ({ row }) => row.original.recordLabel ?? "-" },
    {
      id: "createdAt",
      header: "Timestamp",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
    },
  ]

  const loginColumns: ColumnDef<LoginHistoryItem, unknown>[] = [
    { id: "org", header: "Organization", cell: ({ row }) => <OrgCell organization={row.original.organization} /> },
    { accessorKey: "emailAttempted", header: "Email" },
    {
      id: "action",
      header: "Result",
      cell: ({ row }) => (
        <Badge variant={LOGIN_ACTION_VARIANT[row.original.action]}>{LOGIN_ACTION_LABEL[row.original.action]}</Badge>
      ),
    },
    { id: "reason", header: "Reason", cell: ({ row }) => row.original.reason ?? "-" },
    { id: "ip", header: "IP Address", cell: ({ row }) => row.original.ipAddress ?? "-" },
    {
      id: "createdAt",
      header: "Timestamp",
      cell: ({ row }) => new Date(row.original.createdAt).toLocaleString(),
    },
  ]

  return (
    <SuperAdminShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Audit Logs</h1>
          <p className="text-sm text-muted-foreground">
            Activity and login history across every organization, plus platform-level (org-agnostic) events.
          </p>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="size-4" /> Activity Log
              </CardTitle>
              <CardDescription>Create/update/delete and other tracked actions, newest first.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={auditOrgId}
                onValueChange={(v) => {
                  if (!v) return
                  setAuditOrgId(v)
                  setAuditPage(1)
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All organizations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All organizations</SelectItem>
                  {orgs.map((org) => (
                    <SelectItem key={org._id} value={org._id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={loadAudit} disabled={auditLoading} aria-label="Refresh">
                <RefreshCw className={auditLoading ? "size-4 animate-spin" : "size-4"} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <DataTable
              columns={auditColumns}
              data={auditData?.items ?? []}
              isLoading={auditLoading}
              emptyMessage="No activity recorded."
            />
            {auditData && <Pagination page={auditData.page} totalPages={auditData.totalPages} onPageChange={setAuditPage} />}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <KeyRound className="size-4" /> Login History
              </CardTitle>
              <CardDescription>Login attempts and logouts across every organization, newest first.</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={loginOrgId}
                onValueChange={(v) => {
                  if (!v) return
                  setLoginOrgId(v)
                  setLoginPage(1)
                }}
              >
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All organizations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All organizations</SelectItem>
                  {orgs.map((org) => (
                    <SelectItem key={org._id} value={org._id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={loadLogins} disabled={loginLoading} aria-label="Refresh">
                <RefreshCw className={loginLoading ? "size-4 animate-spin" : "size-4"} />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <DataTable
              columns={loginColumns}
              data={loginData?.items ?? []}
              isLoading={loginLoading}
              emptyMessage="No login activity recorded."
            />
            {loginData && <Pagination page={loginData.page} totalPages={loginData.totalPages} onPageChange={setLoginPage} />}
          </CardContent>
        </Card>
      </div>
    </SuperAdminShell>
  )
}
