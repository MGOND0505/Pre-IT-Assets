"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/common/data-table"
import { Pagination } from "@/components/common/pagination"
import { UserStatusBadge } from "@/components/users/user-status-badge"
import { SuperAdminShell } from "@/components/layout/super-admin-shell"
import { FullPageLoader } from "@/components/layout/full-page-loader"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"

const ALL_ORGS = "__all_orgs__"

type GlobalUser = {
  _id: string
  name: string
  email: string
  employeeId?: string
  organization: { _id: string; name: string; slug: string } | null
  department: { _id: string; name: string } | null
  isAdmin: boolean
  employeeTier: "subAdmin" | "employee" | null
  status: "Active" | "Inactive"
  createdDate: string
}

type PaginatedGlobalUsers = {
  items: GlobalUser[]
  total: number
  page: number
  limit: number
  totalPages: number
}

type OrgOption = { _id: string; name: string; slug: string }

// Local copy of frontend/app/[org]/(dashboard)/users/page.tsx#roleLabel's display logic (that
// file's row also carries roleTemplate, which this flat directory intentionally doesn't fetch -
// see globalUsers.service.ts's doc comment) - kept as a small local copy per this phase's "no
// cross-app import" scope note rather than sharing a module across the org-scoped/flat boundary.
function roleLabel(row: { isAdmin: boolean; employeeTier: "subAdmin" | "employee" | null }): string {
  if (row.isAdmin) return "Admin"
  return row.employeeTier === "employee" ? "Employee" : "Sub Admin"
}

/**
 * Flat, cross-organization, read-only user directory for the Super Admin panel (Phase 8) - lets
 * a Super Admin search/browse every organization's users from one screen instead of visiting each
 * organization's own /{orgSlug}/users page one at a time. Deliberately thin: the only per-row
 * action is a link INTO that existing org-scoped page, where every actual mutating action (edit
 * permissions, activate/deactivate, reset password, delete, ...) already lives - see
 * globalUsers.service.ts's doc comment for the backend side of this scope boundary.
 */
export default function GlobalUsersPage() {
  const { user, loading: authLoading } = useAuth()
  const router = useRouter()
  const [data, setData] = React.useState<PaginatedGlobalUsers | null>(null)
  const [organizations, setOrganizations] = React.useState<OrgOption[]>([])
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [searchInput, setSearchInput] = React.useState("")
  const [search, setSearch] = React.useState("")
  const [organizationId, setOrganizationId] = React.useState(ALL_ORGS)

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
    const timer = setTimeout(() => setSearch(searchInput), 300)
    return () => clearTimeout(timer)
  }, [searchInput])

  React.useEffect(() => {
    setPage(1)
  }, [search, organizationId])

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<PaginatedGlobalUsers>>("/users", {
        params: {
          page,
          limit: 20,
          search: search || undefined,
          organizationId: organizationId === ALL_ORGS ? undefined : organizationId,
        },
      })
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load users"))
    } finally {
      setLoading(false)
    }
  }, [page, search, organizationId])

  React.useEffect(() => {
    if (user?.role === "superAdmin") load()
  }, [user, load])

  React.useEffect(() => {
    if (user?.role !== "superAdmin") return
    let cancelled = false
    apiClient
      .get<ApiEnvelope<{ items: OrgOption[] }>>("/organizations", { params: { limit: 500 } })
      .then((res) => {
        if (!cancelled) setOrganizations(res.data.data.items)
      })
      .catch((err) => {
        if (!cancelled) toast.error(apiErrorMessage(err, "Could not load organizations"))
      })
    return () => {
      cancelled = true
    }
  }, [user])

  const columns: ColumnDef<GlobalUser, unknown>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "email", header: "Email" },
    {
      id: "organization",
      header: "Organization",
      cell: ({ row }) =>
        row.original.organization ? (
          <Badge variant="outline">{row.original.organization.name}</Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
    },
    {
      id: "role",
      header: "Role",
      cell: ({ row }) => {
        const label = roleLabel(row.original)
        const variant = row.original.isAdmin
          ? "default"
          : row.original.employeeTier === "employee"
            ? "outline"
            : "secondary"
        return <Badge variant={variant}>{label}</Badge>
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => <UserStatusBadge status={row.original.status} />,
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) =>
        row.original.organization ? (
          <Link
            href={`/${row.original.organization.slug}/users`}
            className="text-sm font-medium text-primary hover:underline"
          >
            Manage in {row.original.organization.name} &rarr;
          </Link>
        ) : null,
    },
  ]

  if (authLoading || !user || user.role !== "superAdmin") return <FullPageLoader />

  return (
    <SuperAdminShell>
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            Search and browse users across every organization. Manage an account from its own organization&apos;s
            Users page.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input
            placeholder="Search by name, email, or employee ID..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="sm:max-w-xs"
          />
          <Select value={organizationId} onValueChange={(v) => v && setOrganizationId(v)}>
            <SelectTrigger className="sm:w-64">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_ORGS}>All organizations</SelectItem>
              {organizations.map((org) => (
                <SelectItem key={org._id} value={org._id}>
                  {org.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DataTable columns={columns} data={data?.items ?? []} isLoading={loading} emptyMessage="No users found." />
        {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}
      </div>
    </SuperAdminShell>
  )
}
