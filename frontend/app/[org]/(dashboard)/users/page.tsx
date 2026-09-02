"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { MagneticButton } from "@/components/ui/magnetic-button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DataTable } from "@/components/common/data-table"
import { Pagination } from "@/components/common/pagination"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { UserStatusBadge } from "@/components/users/user-status-badge"
import { AdminResetPasswordDialog } from "@/components/users/admin-reset-password-dialog"
import { LeaveStatusDialog } from "@/components/users/leave-status-dialog"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can, PERMISSION_MODULES, type PermissionsShape } from "@/lib/permissions"
import { useRoleOptions } from "@/lib/use-lookup-options"
import { useOrgHref } from "@/lib/use-org-href"

const NO_ROLE = "__org_default__"

type User = {
  _id: string
  name: string
  email: string
  employeeId?: string
  department: { _id: string; name: string } | null
  isAdmin: boolean
  employeeTier: "subAdmin" | "employee" | null
  permissions: PermissionsShape
  roleTemplate?: { _id: string; name: string; portalType: "subAdmin" | "employee" } | null
  status: "Active" | "Inactive"
  isOnLeave: boolean
  backupAgent: string | null
  createdDate: string
}

type PaginatedUsers = {
  items: User[]
  total: number
  page: number
  limit: number
  totalPages: number
}

// null covers every pre-existing account created before employeeTier existed - treated
// identically to "subAdmin" everywhere else in the app (users/[id]/permissions/page.tsx's own
// roleOf), so label it the same way here too. A user with a saved Role applied shows that
// Role's own name instead of the generic 3-tier label, so admins can see at a glance which
// named template (if any) was last applied - falls back to the generic label otherwise.
function roleLabel(user: User): string {
  if (user.roleTemplate) return user.roleTemplate.name
  if (user.isAdmin) return "Admin"
  return user.employeeTier === "employee" ? "Employee" : "Sub Admin"
}

function permissionSummary(user: User): string {
  if (user.isAdmin) return "Admin (all)"
  const grantedModules = PERMISSION_MODULES.filter((moduleKey) =>
    Object.values(user.permissions[moduleKey]).some(Boolean)
  )
  if (grantedModules.length === 0) return "No access"
  return `${grantedModules.length} of ${PERMISSION_MODULES.length} modules`
}

export default function UsersPage() {
  const toOrgHref = useOrgHref()
  const { user: currentUser, loading: authLoading } = useAuth()
  const searchParams = useSearchParams()
  // Seeds the initial filter from a deep link like /users?role=orgAdmin (the Organization
  // Details page's "Admins" tab) - not a visible filter control, just a starting query.
  const initialRole = searchParams.get("role")
  const [data, setData] = React.useState<PaginatedUsers | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [pendingStatusChange, setPendingStatusChange] = React.useState<User | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<User | null>(null)
  const [resetPasswordUser, setResetPasswordUser] = React.useState<User | null>(null)
  const [leaveStatusUser, setLeaveStatusUser] = React.useState<User | null>(null)
  const [pendingReturnFromLeave, setPendingReturnFromLeave] = React.useState<User | null>(null)
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set())
  const [pendingBulkPermissions, setPendingBulkPermissions] = React.useState(false)
  const [applyingBulkPermissions, setApplyingBulkPermissions] = React.useState(false)
  // No portalType filter here - bulk-apply can target a mix of Sub Admin and Employee accounts
  // at once, unlike the create/edit dialogs which only ever configure one tier at a time.
  const [bulkRoleId, setBulkRoleId] = React.useState(NO_ROLE)
  const { items: bulkRoleOptions } = useRoleOptions()

  const canView = can(currentUser, "users", "view")
  const canDelete = can(currentUser, "users", "delete")
  // Creating a user and every privilege-affecting action (permissions, activate/deactivate,
  // reset password) stay Admin-only on the backend regardless of the granular `users` module -
  // granting users:create/update there would otherwise let a Team Member mint or promote an
  // account to Admin. Mirrored here so these controls don't show only to 403 on click.
  const canManagePrivileged = Boolean(currentUser?.isAdmin)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<PaginatedUsers>>("/users", {
        params: { page, limit: 10, role: initialRole ?? undefined },
      })
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load users"))
    } finally {
      setLoading(false)
    }
  }, [page, initialRole])

  React.useEffect(() => {
    if (canView) load()
  }, [canView, load])

  async function toggleStatus(targetUser: User) {
    const nextStatus = targetUser.status === "Active" ? "deactivate" : "activate"
    try {
      await apiClient.patch(`/users/${targetUser._id}/${nextStatus}`)
      toast.success(`${targetUser.email} ${nextStatus}d`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update user status"))
    } finally {
      setPendingStatusChange(null)
    }
  }

  async function handleReturnFromLeave(targetUser: User) {
    try {
      await apiClient.patch(`/users/${targetUser._id}/leave`, { isOnLeave: false })
      toast.success(`${targetUser.email} marked back from leave`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update leave status"))
    } finally {
      setPendingReturnFromLeave(null)
    }
  }

  async function handleDelete(targetUser: User) {
    try {
      await apiClient.delete(`/users/${targetUser._id}`)
      toast.success(`${targetUser.email} deleted`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete user"))
    } finally {
      setPendingDelete(null)
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Only teamMember accounts are eligible - the backend skips isAdmin accounts entirely
  // (their access comes from the isAdmin bypass, not the permission matrix), so selecting
  // them here would just produce a confusing "skipped" result.
  const selectableIdsOnPage = (data?.items ?? []).filter((u) => !u.isAdmin).map((u) => u._id)
  const allOnPageSelected =
    selectableIdsOnPage.length > 0 && selectableIdsOnPage.every((id) => selectedIds.has(id))

  function toggleAllOnPage() {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allOnPageSelected) {
        selectableIdsOnPage.forEach((id) => next.delete(id))
      } else {
        selectableIdsOnPage.forEach((id) => next.add(id))
      }
      return next
    })
  }

  async function applyBulkDefaultPermissions() {
    setApplyingBulkPermissions(true)
    try {
      const res = await apiClient.post<
        ApiEnvelope<{ updated: number; skipped: string[] }>
      >("/users/bulk-apply-default-permissions", {
        userIds: Array.from(selectedIds),
        // Omitted (org default template) unless a saved Role was picked in the dialog.
        roleId: bulkRoleId === NO_ROLE ? undefined : bulkRoleId,
      })
      const { updated, skipped } = res.data.data
      if (updated > 0) toast.success(`Permissions applied to ${updated} user(s)`)
      if (skipped.length > 0) toast.warning(`Skipped ${skipped.length}: ${skipped.slice(0, 3).join(", ")}${skipped.length > 3 ? "..." : ""}`)
      setSelectedIds(new Set())
      setBulkRoleId(NO_ROLE)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not apply permissions"))
    } finally {
      setApplyingBulkPermissions(false)
      setPendingBulkPermissions(false)
    }
  }

  const columns: ColumnDef<User, unknown>[] = [
    ...(canManagePrivileged
      ? [
          {
            id: "select",
            header: () => (
              <Checkbox
                checked={allOnPageSelected}
                onCheckedChange={toggleAllOnPage}
                aria-label="Select all eligible users on this page"
              />
            ),
            cell: ({ row }: { row: { original: User } }) =>
              row.original.isAdmin ? null : (
                <Checkbox
                  checked={selectedIds.has(row.original._id)}
                  onCheckedChange={() => toggleRow(row.original._id)}
                  aria-label={`Select ${row.original.email}`}
                />
              ),
          } satisfies ColumnDef<User, unknown>,
        ]
      : []),
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span title={row.original.name} className="block min-w-[110px] max-w-[170px] whitespace-normal break-words">
          {row.original.name}
        </span>
      ),
    },
    {
      accessorKey: "email",
      header: "Email",
      meta: { hideBelow: "sm" },
      cell: ({ row }) => (
        <span title={row.original.email} className="block min-w-[150px] max-w-[220px] whitespace-normal break-words">
          {row.original.email}
        </span>
      ),
    },
    {
      accessorKey: "department",
      header: "Department",
      meta: { hideBelow: "md" },
      cell: ({ row }) => (
        <span title={row.original.department?.name} className="block min-w-[100px] max-w-[150px] whitespace-normal break-words">
          {row.original.department?.name ?? "-"}
        </span>
      ),
    },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) => {
        const label = roleLabel(row.original)
        // Badge color still tracks the underlying tier (isAdmin/employeeTier), independent of
        // whether the displayed text is a generic tier label or a named Role's own name.
        const variant = row.original.isAdmin ? "default" : row.original.employeeTier === "employee" ? "outline" : "secondary"
        return <Badge variant={variant}>{label}</Badge>
      },
    },
    {
      id: "permissions",
      header: "Access",
      cell: ({ row }) => (
        <Badge variant={row.original.isAdmin ? "default" : "outline"}>{permissionSummary(row.original)}</Badge>
      ),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <UserStatusBadge status={row.original.status} />
          {row.original.isOnLeave && <Badge variant="warning">On Leave</Badge>}
        </div>
      ),
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
            {canManagePrivileged && (
              <>
                <DropdownMenuItem render={<Link href={toOrgHref(`/users/${row.original._id}/permissions`)} />}>
                  Edit permissions
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setResetPasswordUser(row.original)}>Reset password</DropdownMenuItem>
                <DropdownMenuItem
                  variant={row.original.status === "Active" ? "destructive" : "default"}
                  onClick={() => setPendingStatusChange(row.original)}
                >
                  {row.original.status === "Active" ? "Deactivate" : "Activate"}
                </DropdownMenuItem>
                {row.original.isOnLeave ? (
                  <DropdownMenuItem onClick={() => setPendingReturnFromLeave(row.original)}>
                    Mark back from leave
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={() => setLeaveStatusUser(row.original)}>Mark on leave</DropdownMenuItem>
                )}
              </>
            )}
            {canDelete && (
              <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(row.original)}>
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  if (authLoading) {
    return null
  }

  if (!canView) {
    return (
      <p className="text-sm text-muted-foreground">
        You do not have permission to view this page.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">Manage who has access to this system and what they can do.</p>
        </div>
        {canManagePrivileged && (
          <MagneticButton>
            <Button render={<Link href={toOrgHref("/users/add")} />}>Add user</Button>
          </MagneticButton>
        )}
      </div>

      {canManagePrivileged && selectedIds.size > 0 && (
        <div className="flex items-center gap-3 rounded-lg border bg-muted/40 px-4 py-2.5">
          <span className="text-sm text-muted-foreground">{selectedIds.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => setPendingBulkPermissions(true)}>
            Bulk update permissions
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Clear selection
          </Button>
        </div>
      )}

      <DataTable columns={columns} data={data?.items ?? []} isLoading={loading} emptyMessage="No users yet." />
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}

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
          description="This permanently removes the user account. This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={() => handleDelete(pendingDelete)}
        />
      )}

      {resetPasswordUser && (
        <AdminResetPasswordDialog
          open
          onOpenChange={(open) => !open && setResetPasswordUser(null)}
          userId={resetPasswordUser._id}
          userEmail={resetPasswordUser.email}
        />
      )}

      {leaveStatusUser && (
        <LeaveStatusDialog
          open
          onOpenChange={(open) => !open && setLeaveStatusUser(null)}
          userId={leaveStatusUser._id}
          userName={leaveStatusUser.name}
          currentBackupAgentId={leaveStatusUser.backupAgent}
          onSaved={load}
        />
      )}

      {pendingReturnFromLeave && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingReturnFromLeave(null)}
          title={`Mark ${pendingReturnFromLeave.email} back from leave?`}
          description="They'll become eligible for new ticket auto-assignment again. Tickets already handed to their backup agent will NOT move back automatically."
          confirmLabel="Mark back"
          onConfirm={() => handleReturnFromLeave(pendingReturnFromLeave)}
        />
      )}

      {pendingBulkPermissions && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open && !applyingBulkPermissions) {
              setPendingBulkPermissions(false)
              setBulkRoleId(NO_ROLE)
            }
          }}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Apply permissions to {selectedIds.size} user(s)?</DialogTitle>
              <DialogDescription>
                {bulkRoleId === NO_ROLE
                  ? "This replaces each selected user's current permissions with the organization's Employee Default Permissions template (configured under Administration > Settings)."
                  : "This replaces each selected user's current permissions (and portal type) with the picked saved Role's own permissions."}{" "}
                Admin accounts are skipped. They&apos;ll be affected immediately.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bulk-role-template">Saved role (optional)</Label>
              <Select value={bulkRoleId} onValueChange={(v) => v && setBulkRoleId(v)}>
                <SelectTrigger id="bulk-role-template" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_ROLE}>Organization default (Employee Default Permissions)</SelectItem>
                  {bulkRoleOptions.map((r) => (
                    <SelectItem key={r._id} value={r._id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button variant="outline" disabled={applyingBulkPermissions} onClick={() => setPendingBulkPermissions(false)}>
                Cancel
              </Button>
              <Button disabled={applyingBulkPermissions} onClick={applyBulkDefaultPermissions}>
                {applyingBulkPermissions ? "Applying..." : "Apply"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
