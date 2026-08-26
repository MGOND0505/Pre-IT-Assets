"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTable } from "@/components/common/data-table"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { UserStatusBadge } from "@/components/users/user-status-badge"
import { SuperAdminShell } from "@/components/layout/super-admin-shell"
import { FullPageLoader } from "@/components/layout/full-page-loader"
import { CreateSubSuperAdminDialog } from "@/components/sub-super-admins/create-sub-super-admin-dialog"
import { EditSubOrgAccessDialog } from "@/components/sub-super-admins/edit-sub-org-access-dialog"
import { ResetSubSuperAdminPasswordDialog } from "@/components/sub-super-admins/reset-sub-super-admin-password-dialog"
import type { OrgAccessEntry, OrgOption } from "@/components/sub-super-admins/org-access-editor"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"

type SubSuperAdmin = {
  _id: string
  name: string
  email: string
  status: "Active" | "Inactive"
  orgAccess: { organization: { _id: string; name: string; slug: string } | null; permissions: unknown }[]
}

type AccessRequest = {
  _id: string
  subSuperAdmin: { name: string; email: string } | null
  organization: { name: string; slug: string } | null
  reason: string
  status: "Pending" | "Approved" | "Denied"
  createdDate: string
}

export default function SubSuperAdminsPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [items, setItems] = React.useState<SubSuperAdmin[]>([])
  const [organizations, setOrganizations] = React.useState<OrgOption[]>([])
  const [accessRequests, setAccessRequests] = React.useState<AccessRequest[]>([])
  const [loading, setLoading] = React.useState(true)
  const [accessTarget, setAccessTarget] = React.useState<SubSuperAdmin | null>(null)
  const [resetTarget, setResetTarget] = React.useState<SubSuperAdmin | null>(null)
  const [pendingStatusChange, setPendingStatusChange] = React.useState<SubSuperAdmin | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<SubSuperAdmin | null>(null)

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
      const [ssaRes, orgRes, requestsRes] = await Promise.all([
        apiClient.get<ApiEnvelope<SubSuperAdmin[]>>("/sub-super-admins"),
        apiClient.get<ApiEnvelope<{ items: OrgOption[] }>>("/organizations", { params: { limit: 100 } }),
        apiClient.get<ApiEnvelope<AccessRequest[]>>("/access-requests"),
      ])
      setItems(ssaRes.data.data)
      setOrganizations(orgRes.data.data.items)
      setAccessRequests(requestsRes.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load Sub-Super Admins"))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (user?.role === "superAdmin") load()
  }, [user, load])

  function toAccessEntries(ssa: SubSuperAdmin): OrgAccessEntry[] {
    return ssa.orgAccess
      .filter((g) => g.organization)
      .map((g) => ({ organization: g.organization!._id, permissions: g.permissions as OrgAccessEntry["permissions"] }))
  }

  async function toggleStatus(target: SubSuperAdmin) {
    const nextStatus = target.status === "Active" ? "Inactive" : "Active"
    try {
      await apiClient.patch(`/sub-super-admins/${target._id}/status`, { status: nextStatus })
      toast.success(`${target.email} ${nextStatus === "Active" ? "activated" : "deactivated"}`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update status"))
    } finally {
      setPendingStatusChange(null)
    }
  }

  async function decideAccessRequest(id: string, decision: "Approved" | "Denied") {
    try {
      await apiClient.patch(`/access-requests/${id}`, { decision })
      toast.success(decision === "Approved" ? "Access granted" : "Request denied")
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update access request"))
    }
  }

  async function handleDelete(target: SubSuperAdmin) {
    try {
      await apiClient.delete(`/sub-super-admins/${target._id}`)
      toast.success(`${target.email} deleted`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete Sub-Super Admin"))
    } finally {
      setPendingDelete(null)
    }
  }

  const columns: ColumnDef<SubSuperAdmin, unknown>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "email", header: "Email" },
    {
      id: "organizations",
      header: "Organizations",
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.orgAccess.filter((g) => g.organization).length === 0 ? (
            <span className="text-muted-foreground">None</span>
          ) : (
            row.original.orgAccess
              .filter((g) => g.organization)
              .map((g) => (
                <Badge key={g.organization!._id} variant="outline">
                  {g.organization!.name}
                </Badge>
              ))
          )}
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <UserStatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Row actions">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setAccessTarget(row.original)}>Edit access</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setResetTarget(row.original)}>Reset password</DropdownMenuItem>
            <DropdownMenuItem
              variant={row.original.status === "Active" ? "destructive" : "default"}
              onClick={() => setPendingStatusChange(row.original)}
            >
              {row.original.status === "Active" ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(row.original)}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  if (authLoading || !user || user.role !== "superAdmin") return <FullPageLoader />

  return (
    <SuperAdminShell>
      <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sub-Super Admins</h1>
          <p className="text-sm text-muted-foreground">
            Users with module-wise access to a chosen set of organizations.
          </p>
        </div>
        <CreateSubSuperAdminDialog organizations={organizations} onCreated={load} />
      </div>

      <DataTable columns={columns} data={items} isLoading={loading} emptyMessage="No Sub-Super Admins yet." />

      {accessRequests.filter((r) => r.status === "Pending").length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight">Access Requests</h2>
          <div className="flex flex-col gap-2">
            {accessRequests
              .filter((r) => r.status === "Pending")
              .map((request) => (
                <div key={request._id} className="flex items-center justify-between rounded-md border p-3 text-sm">
                  <div>
                    <span className="font-medium">{request.subSuperAdmin?.name ?? "Unknown"}</span>
                    {" requests access to "}
                    <span className="font-medium">{request.organization?.name ?? "an organization"}</span>
                    {request.reason && <p className="mt-1 text-muted-foreground">&ldquo;{request.reason}&rdquo;</p>}
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => decideAccessRequest(request._id, "Approved")}>
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => decideAccessRequest(request._id, "Denied")}
                    >
                      Deny
                    </Button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {accessTarget && (
        <EditSubOrgAccessDialog
          open
          onOpenChange={(open) => !open && setAccessTarget(null)}
          subSuperAdminId={accessTarget._id}
          subSuperAdminEmail={accessTarget.email}
          organizations={organizations}
          currentAccess={toAccessEntries(accessTarget)}
          onSaved={load}
        />
      )}

      {resetTarget && (
        <ResetSubSuperAdminPasswordDialog
          open
          onOpenChange={(open) => !open && setResetTarget(null)}
          subSuperAdminId={resetTarget._id}
          subSuperAdminEmail={resetTarget.email}
        />
      )}

      {pendingStatusChange && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingStatusChange(null)}
          title={`${pendingStatusChange.status === "Active" ? "Deactivate" : "Activate"} ${pendingStatusChange.email}?`}
          description={
            pendingStatusChange.status === "Active"
              ? "They will be immediately logged out and unable to sign in until reactivated."
              : "They will be able to sign in again."
          }
          confirmLabel={pendingStatusChange.status === "Active" ? "Deactivate" : "Activate"}
          destructive={pendingStatusChange.status === "Active"}
          onConfirm={() => toggleStatus(pendingStatusChange)}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingDelete(null)}
          title={`Delete ${pendingDelete.email}?`}
          description="This permanently removes the account. This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={() => handleDelete(pendingDelete)}
        />
      )}
      </div>
    </SuperAdminShell>
  )
}
