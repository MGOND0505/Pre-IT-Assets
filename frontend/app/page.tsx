"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { Download, LayoutGrid, ChevronDown, MoreHorizontal, Filter } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTable } from "@/components/common/data-table"
import { Pagination } from "@/components/common/pagination"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { AppLogo } from "@/components/layout/app-logo"
import { SuperAdminShell } from "@/components/layout/super-admin-shell"
import { FullPageLoader } from "@/components/layout/full-page-loader"
import { CreateOrganizationDialog } from "@/components/organizations/create-organization-dialog"
import { ModuleAccessPanel } from "@/components/organizations/module-access-panel"
import { OrganizationsPagination } from "@/components/organizations/organizations-pagination"
import { RequestAccessDialog } from "@/components/sub-super-admins/request-access-dialog"
import { LandingPage } from "@/components/landing/landing-page"
import type { EntitlementModule } from "@/lib/permissions"

type SubscriptionState = "Active" | "ExpiringSoon" | "GracePeriod" | "Suspended"

const SUBSCRIPTION_LABELS: Record<SubscriptionState, string> = {
  Active: "Active",
  ExpiringSoon: "Expiring Soon",
  GracePeriod: "Grace Period",
  Suspended: "Suspended",
}

type OrganizationRow = {
  _id: string
  name: string
  slug: string
  code: string | null
  status: "Active" | "Inactive"
  subscriptionState: SubscriptionState
  enabledModules: EntitlementModule[]
  validUntil: string | null
  admin: { name: string; email: string } | null
  userCount: number
  deletedAt: string | null
  daysRemaining: number | null
  recycleBinRetentionDays: number
}

const AVATAR_COLORS = ["#2563eb", "#7c3aed", "#0891b2", "#16a34a", "#ea580c", "#db2777"]

function orgInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function orgColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

type PaginatedOrganizations = {
  items: OrganizationRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}

type GrantedOrganization = {
  _id: string
  name: string
  slug: string
  status: "Active" | "Inactive"
  recycleBinRetentionDays: number
}

type BrowsableOrganization = { _id: string; name: string; slug: string }

type AccessRequestStatus = "Pending" | "Approved" | "Denied"

type MyAccessRequest = {
  _id: string
  organization: { _id: string; name: string; slug: string } | null
  status: AccessRequestStatus
  createdDate: string
}

/**
 * The bare "/" route - reached only by a superAdmin or subSuperAdmin (organization: null),
 * since every orgAdmin/teamMember lands on their own "/{orgSlug}" after login instead.
 *  - superAdmin sees every organization on the system (Organizations list + Create).
 *  - subSuperAdmin sees only the organizations THEY were granted, no create/edit/suspend
 *    actions (those stay Super-Admin-only).
 * Both link into an org's "/{orgSlug}/organization" Overview / "/{orgSlug}" dashboard.
 */
export default function RootPage() {
  const { user, loading: authLoading, logout } = useAuth()
  const router = useRouter()
  const [data, setData] = React.useState<PaginatedOrganizations | null>(null)
  const [granted, setGranted] = React.useState<GrantedOrganization[] | null>(null)
  const [browsableOrgs, setBrowsableOrgs] = React.useState<BrowsableOrganization[]>([])
  const [myRequests, setMyRequests] = React.useState<MyAccessRequest[]>([])
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [pendingStatusChange, setPendingStatusChange] = React.useState<OrganizationRow | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<OrganizationRow | null>(null)
  const [view, setView] = React.useState<"organizations" | "recycleBin" | "retentionPolicy">("organizations")
  const [deletedData, setDeletedData] = React.useState<PaginatedOrganizations | null>(null)
  const [deletedLoading, setDeletedLoading] = React.useState(false)
  const [deletedPage, setDeletedPage] = React.useState(1)
  const [pendingRestore, setPendingRestore] = React.useState<OrganizationRow | null>(null)
  const [editingRetention, setEditingRetention] = React.useState<GrantedOrganization | null>(null)
  const [editingOrgRetention, setEditingOrgRetention] = React.useState<OrganizationRow | null>(null)
  const [moduleAccessTarget, setModuleAccessTarget] = React.useState<OrganizationRow | null>(null)
  const [limit, setLimit] = React.useState(20)
  const [searchInput, setSearchInput] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<"Active" | "Inactive" | undefined>(undefined)

  React.useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  React.useEffect(() => {
    setPage(1)
  }, [search, limit, statusFilter])

  React.useEffect(() => {
    if (authLoading || !user) return
    if (user.organization) {
      router.replace(`/${user.organization.slug}`)
    }
  }, [authLoading, user, router])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<PaginatedOrganizations>>("/organizations", {
        params: { page, limit, search: search || undefined, status: statusFilter },
      })
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load organizations"))
    } finally {
      setLoading(false)
    }
  }, [page, limit, search, statusFilter])

  const loadGranted = React.useCallback(async () => {
    setLoading(true)
    try {
      const [grantedRes, orgsRes, requestsRes] = await Promise.all([
        apiClient.get<ApiEnvelope<GrantedOrganization[]>>("/my-organizations"),
        apiClient.get<ApiEnvelope<BrowsableOrganization[]>>("/access-requests/organizations"),
        apiClient.get<ApiEnvelope<MyAccessRequest[]>>("/access-requests"),
      ])
      setGranted(grantedRes.data.data)
      setBrowsableOrgs(orgsRes.data.data)
      setMyRequests(requestsRes.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load your organizations"))
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDeleted = React.useCallback(async () => {
    setDeletedLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<PaginatedOrganizations>>("/organizations/deleted", {
        params: { page: deletedPage, limit: 20 },
      })
      setDeletedData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load deleted organizations"))
    } finally {
      setDeletedLoading(false)
    }
  }, [deletedPage])

  React.useEffect(() => {
    if (user?.role === "superAdmin") load()
    if (user?.role === "subSuperAdmin") loadGranted()
  }, [user, load, loadGranted])

  React.useEffect(() => {
    if (user?.role === "superAdmin" && view === "recycleBin") loadDeleted()
  }, [user, view, loadDeleted])

  async function restoreOrganization(org: OrganizationRow) {
    try {
      await apiClient.post(`/organizations/${org._id}/restore`)
      toast.success(`${org.name} restored`)
      loadDeleted()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not restore organization"))
    } finally {
      setPendingRestore(null)
    }
  }

  async function toggleStatus(org: OrganizationRow) {
    const nextStatus = org.status === "Active" ? "Inactive" : "Active"
    try {
      await apiClient.patch(`/organizations/${org._id}/status`, { status: nextStatus })
      toast.success(`${org.name} ${nextStatus === "Active" ? "activated" : "deactivated"}`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update organization status"))
    } finally {
      setPendingStatusChange(null)
    }
  }

  async function deleteOrganization(org: OrganizationRow) {
    try {
      await apiClient.delete(`/organizations/${org._id}`)
      toast.success(`${org.name} moved to the Recycle Bin`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete organization"))
    } finally {
      setPendingDelete(null)
    }
  }

  const columns: ColumnDef<OrganizationRow, unknown>[] = [
    {
      accessorKey: "name",
      header: "Organization",
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
            style={{ backgroundColor: orgColor(row.original.name) }}
          >
            {orgInitials(row.original.name)}
          </span>
          <a
            href={`/${row.original.slug}/organization`}
            className="font-medium text-primary hover:underline"
            onClick={(e) => {
              e.preventDefault()
              router.push(`/${row.original.slug}/organization`)
            }}
          >
            {row.original.name}
          </a>
        </div>
      ),
    },
    { accessorKey: "code", header: "Code", cell: ({ row }) => row.original.code ?? "-" },
    {
      id: "admin",
      header: "Admin",
      cell: ({ row }) => row.original.admin?.name ?? "-",
    },
    { accessorKey: "userCount", header: "Users" },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "Active" ? "default" : "outline"}>{row.original.status}</Badge>
      ),
    },
    {
      id: "subscription",
      header: "Subscription",
      cell: ({ row }) => (
        <div className="flex flex-col gap-0.5">
          <Badge variant={row.original.subscriptionState === "Active" ? "default" : "outline"}>
            {SUBSCRIPTION_LABELS[row.original.subscriptionState]}
          </Badge>
          {row.original.validUntil && (
            <span className="text-xs text-muted-foreground">
              Until {new Date(row.original.validUntil).toLocaleDateString()}
            </span>
          )}
        </div>
      ),
    },
    {
      id: "moduleAccess",
      header: "Module Access",
      cell: ({ row }) => (
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setModuleAccessTarget(row.original)}>
          <LayoutGrid className="size-3.5" />
          {row.original.enabledModules.length} Module{row.original.enabledModules.length === 1 ? "" : "s"}
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </Button>
      ),
    },
    {
      id: "action",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push(`/${row.original.slug}/organization`)}>
            View
          </Button>
          <Button variant="outline" size="sm" onClick={() => setModuleAccessTarget(row.original)}>
            <LayoutGrid className="size-3.5" />
            Module Access
          </Button>
          <Button
            variant={row.original.status === "Active" ? "destructive" : "default"}
            size="sm"
            onClick={() => setPendingStatusChange(row.original)}
          >
            {row.original.status === "Active" ? "Deactivate" : "Activate"}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button variant="outline" size="icon-sm" aria-label="More actions">
                  <MoreHorizontal className="size-4" />
                </Button>
              }
            />
            <DropdownMenuContent align="end">
              <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(row.original)}>
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ]

  const deletedColumns: ColumnDef<OrganizationRow, unknown>[] = [
    { accessorKey: "name", header: "Organization" },
    { accessorKey: "slug", header: "Slug" },
    {
      accessorKey: "deletedAt",
      header: "Deleted On",
      cell: ({ row }) => (row.original.deletedAt ? new Date(row.original.deletedAt).toLocaleString() : "-"),
    },
    {
      id: "daysRemaining",
      header: "Restore Window",
      cell: ({ row }) => {
        const days = row.original.daysRemaining
        if (days === null) return "-"
        return (
          <Badge variant={days <= 7 ? "destructive" : "outline"}>
            {days} day{days === 1 ? "" : "s"} remaining
          </Badge>
        )
      },
    },
    {
      id: "action",
      header: "Action",
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => setPendingRestore(row.original)}>
          Restore
        </Button>
      ),
    },
  ]

  const retentionColumns: ColumnDef<OrganizationRow, unknown>[] = [
    { accessorKey: "name", header: "Organization" },
    { accessorKey: "slug", header: "Slug" },
    {
      id: "retentionPolicy",
      header: "Retention Policy",
      cell: ({ row }) => `${row.original.recycleBinRetentionDays} day(s)`,
    },
    {
      id: "action",
      header: "Action",
      cell: ({ row }) => (
        <Button variant="outline" size="sm" onClick={() => setEditingOrgRetention(row.original)}>
          Configure
        </Button>
      ),
    },
  ]

  const grantedColumns: ColumnDef<GrantedOrganization, unknown>[] = [
    {
      accessorKey: "name",
      header: "Organization",
      cell: ({ row }) => (
        <a
          href={`/${row.original.slug}`}
          className="font-medium text-primary hover:underline"
          onClick={(e) => {
            e.preventDefault()
            router.push(`/${row.original.slug}`)
          }}
        >
          {row.original.name}
        </a>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "Active" ? "default" : "outline"}>{row.original.status}</Badge>
      ),
    },
    {
      id: "retention",
      header: "Recycle Bin Retention",
      cell: ({ row }) => `${row.original.recycleBinRetentionDays} day(s)`,
    },
    {
      id: "action",
      header: "Action",
      cell: ({ row }) => (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push(`/${row.original.slug}`)}>
            Open
          </Button>
          <Button variant="outline" size="sm" onClick={() => setEditingRetention(row.original)}>
            Edit Retention
          </Button>
        </div>
      ),
    },
  ]

  if (authLoading) return <FullPageLoader />
  if (!user) return <LandingPage />
  if (user.organization) return <FullPageLoader />

  const isSuperAdmin = user.role === "superAdmin"

  const pageBody = (
    <div className="flex flex-col gap-6">
      {!isSuperAdmin && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <AppLogo imgClassName="h-8 max-w-40 object-contain" textClassName="text-base font-semibold tracking-tight" />
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm text-muted-foreground">{user.name} · Sub-Super Admin</span>
            <Button variant="outline" size="sm" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isSuperAdmin && view === "recycleBin"
              ? "Recycle Bin"
              : isSuperAdmin && view === "retentionPolicy"
                ? "Organization-Wise Retention Policy"
                : "Organizations"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {isSuperAdmin
              ? view === "recycleBin"
                ? "Deleted organizations - restorable for 90 days, after which they're permanently and automatically removed."
                : view === "retentionPolicy"
                  ? "How long deleted data inside each organization's own Recycle Bin stays restorable (30-180 days) before it's permanently and automatically removed."
                  : "All organizations on this system."
              : "Organizations assigned to you."}
          </p>
        </div>
        {isSuperAdmin ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setView((v) => (v === "retentionPolicy" ? "organizations" : "retentionPolicy"))}
            >
              {view === "retentionPolicy" ? "Back to Organizations" : "Retention Policy"}
            </Button>
            <Button variant="outline" onClick={() => setView((v) => (v === "recycleBin" ? "organizations" : "recycleBin"))}>
              {view === "recycleBin" ? "Back to Organizations" : "Recycle Bin"}
            </Button>
            {view === "organizations" && (
              <CreateOrganizationDialog onCreated={(slug) => router.push(`/${slug}/organization`)} />
            )}
          </div>
        ) : (
          <RequestAccessDialog organizations={browsableOrgs} onRequested={loadGranted} />
        )}
      </div>

      {isSuperAdmin ? (
        view === "recycleBin" ? (
          <>
            <DataTable
              columns={deletedColumns}
              data={deletedData?.items ?? []}
              isLoading={deletedLoading}
              emptyMessage="No deleted organizations."
            />
            {deletedData && (
              <Pagination page={deletedData.page} totalPages={deletedData.totalPages} onPageChange={setDeletedPage} />
            )}
          </>
        ) : view === "retentionPolicy" ? (
          <>
            <DataTable
              columns={retentionColumns}
              data={data?.items ?? []}
              isLoading={loading}
              emptyMessage="No organizations yet."
            />
            {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}
          </>
        ) : (
          <>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <Input
                placeholder="Search organizations..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="sm:max-w-xs"
              />
              <div className="flex gap-2">
                <Button variant="outline" disabled>
                  <Download className="size-3.5" />
                  Export
                  <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                    Soon
                  </span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button variant="outline" size="icon" aria-label="Filter by status" className="relative">
                        <Filter className="size-4" />
                        {statusFilter && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-primary" />}
                      </Button>
                    }
                  />
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setStatusFilter(undefined)}>All statuses</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter("Active")}>Active only</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter("Inactive")}>Inactive only</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            <DataTable
              columns={columns}
              data={data?.items ?? []}
              isLoading={loading}
              emptyMessage="No organizations yet."
              onRowClick={(row) => router.push(`/${row.slug}/organization`)}
            />
            {data && (
              <OrganizationsPagination
                page={data.page}
                limit={data.limit}
                total={data.total}
                totalPages={data.totalPages}
                onPageChange={setPage}
                onLimitChange={setLimit}
              />
            )}

            {moduleAccessTarget && (
              <ModuleAccessPanel
                organizationId={moduleAccessTarget._id}
                organizationName={moduleAccessTarget.name}
                enabledModules={moduleAccessTarget.enabledModules}
                onClose={() => setModuleAccessTarget(null)}
                onSaved={() => {
                  load()
                  setModuleAccessTarget(null)
                }}
              />
            )}
          </>
        )
      ) : (
        <>
          <DataTable
            columns={grantedColumns}
            data={granted ?? []}
            isLoading={loading}
            emptyMessage="No organizations have been assigned to you yet."
            onRowClick={(row) => router.push(`/${row.slug}`)}
          />

          {myRequests.length > 0 && (
            <div className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold text-muted-foreground">My access requests</h2>
              <div className="flex flex-col gap-2">
                {myRequests.map((request) => (
                  <div
                    key={request._id}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <span>{request.organization?.name ?? "Unknown organization"}</span>
                    <Badge variant={request.status === "Approved" ? "default" : "outline"}>{request.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {pendingStatusChange && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingStatusChange(null)}
          title={`${pendingStatusChange.status === "Active" ? "Deactivate" : "Activate"} ${pendingStatusChange.name}?`}
          description={
            pendingStatusChange.status === "Active"
              ? "Its Org Admin and Team Members will be unable to log in until reactivated. You will still be able to view and manage it."
              : "Its users will be able to log in again."
          }
          confirmLabel={pendingStatusChange.status === "Active" ? "Deactivate" : "Activate"}
          destructive={pendingStatusChange.status === "Active"}
          onConfirm={() => toggleStatus(pendingStatusChange)}
        />
      )}

      {pendingRestore && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingRestore(null)}
          title={`Restore ${pendingRestore.name}?`}
          description="This organization will become active again and its users will be able to log in."
          confirmLabel="Restore"
          onConfirm={() => restoreOrganization(pendingRestore)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingDelete(null)}
          title={`Delete ${pendingDelete.name}?`}
          description={
            "This moves the organization to the Recycle Bin - every user, asset, license, ticket, and task belonging " +
            "to it is hidden and its users can no longer log in. It can be restored at any time within 90 days; " +
            "after that it and all of its data are automatically and permanently deleted, with no way to recover it."
          }
          confirmLabel="Delete Organization"
          destructive
          onConfirm={() => deleteOrganization(pendingDelete)}
        />
      )}

      {editingRetention && (
        <EditRetentionDialog
          open
          onOpenChange={(open) => !open && setEditingRetention(null)}
          organization={editingRetention}
          onSaved={() => {
            loadGranted()
            setEditingRetention(null)
          }}
        />
      )}

      {editingOrgRetention && (
        <EditOrgRetentionDialog
          open
          onOpenChange={(open) => !open && setEditingOrgRetention(null)}
          organization={editingOrgRetention}
          onSaved={() => {
            load()
            setEditingOrgRetention(null)
          }}
        />
      )}
    </div>
  )

  if (isSuperAdmin) {
    return <SuperAdminShell>{pageBody}</SuperAdminShell>
  }

  return <div className="min-h-dvh p-6">{pageBody}</div>
}

function EditOrgRetentionDialog({
  open,
  onOpenChange,
  organization,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organization: OrganizationRow
  onSaved: () => void
}) {
  const [days, setDays] = React.useState(String(organization.recycleBinRetentionDays))
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSave() {
    const parsed = Number(days)
    if (!Number.isInteger(parsed) || parsed < 30 || parsed > 180) {
      toast.error("Retention period must be a whole number of days between 30 and 180")
      return
    }
    setSubmitting(true)
    try {
      await apiClient.put(`/organizations/${organization.slug}`, { recycleBinRetentionDays: parsed })
      toast.success("Retention policy updated")
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update retention policy"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Retention policy - {organization.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="org-retention-policy-days">Days (30-180)</Label>
          <Input
            id="org-retention-policy-days"
            type="number"
            min={30}
            max={180}
            value={days}
            onChange={(e) => setDays(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            How long deleted data inside this organization&apos;s Recycle Bin stays restorable before it&apos;s
            permanently and automatically removed.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditRetentionDialog({
  open,
  onOpenChange,
  organization,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organization: GrantedOrganization
  onSaved: () => void
}) {
  const [days, setDays] = React.useState(String(organization.recycleBinRetentionDays))
  const [submitting, setSubmitting] = React.useState(false)

  async function handleSave() {
    const parsed = Number(days)
    if (!Number.isInteger(parsed) || parsed < 30 || parsed > 180) {
      toast.error("Retention period must be a whole number of days between 30 and 180")
      return
    }
    setSubmitting(true)
    try {
      await apiClient.patch(`/my-organizations/${organization._id}/recycle-bin-retention`, {
        recycleBinRetentionDays: parsed,
      })
      toast.success("Recycle Bin retention updated")
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update retention period"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Recycle Bin retention - {organization.name}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="retention-days">Days (30-180)</Label>
          <Input id="retention-days" type="number" min={30} max={180} value={days} onChange={(e) => setDays(e.target.value)} />
          <p className="text-xs text-muted-foreground">
            How long deleted data inside this organization stays restorable before it&apos;s permanently removed.
          </p>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
