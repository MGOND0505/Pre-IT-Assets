"use client"

import * as React from "react"
import Link from "next/link"
import { type ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MagneticButton } from "@/components/ui/magnetic-button"
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
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

type HelpdeskPriority = {
  _id: string
  name: string
  order: number
  color: string
  slaResponseMinutes: number
  slaResolutionMinutes: number
  status: "Active" | "Inactive"
}

type Paginated = { items: HelpdeskPriority[]; total: number; page: number; totalPages: number }

function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes}m`
  if (minutes % 60 === 0) return `${minutes / 60}h`
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`
}

export default function HelpdeskPrioritiesPage() {
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = React.useState<Paginated | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [pendingDelete, setPendingDelete] = React.useState<HelpdeskPriority | null>(null)

  const canView = can(user, "helpdesk", "view")
  const canWrite = Boolean(user?.isAdmin)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Paginated>>("/helpdesk-priorities", { params: { page, limit: 20 } })
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load priorities"))
    } finally {
      setLoading(false)
    }
  }, [page])

  React.useEffect(() => {
    if (canView) load()
  }, [canView, load])

  async function handleDelete(priority: HelpdeskPriority) {
    try {
      await apiClient.delete(`/helpdesk-priorities/${priority._id}`)
      toast.success(`${priority.name} deleted`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete priority"))
    } finally {
      setPendingDelete(null)
    }
  }

  const columns: ColumnDef<HelpdeskPriority, unknown>[] = [
    {
      accessorKey: "name",
      header: "Name",
      cell: ({ row }) => (
        <span className="flex items-center gap-2">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: row.original.color }} />
          {row.original.name}
        </span>
      ),
    },
    { accessorKey: "order", header: "Order" },
    {
      id: "response",
      header: "SLA Response",
      cell: ({ row }) => formatMinutes(row.original.slaResponseMinutes),
    },
    {
      id: "resolution",
      header: "SLA Resolution",
      cell: ({ row }) => formatMinutes(row.original.slaResolutionMinutes),
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "Active" ? "default" : "outline"}>{row.original.status}</Badge>
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
            {canWrite && (
              <DropdownMenuItem render={<Link href={toOrgHref(`/helpdesk/priorities/${row.original._id}/edit`)} />}>
                Edit
              </DropdownMenuItem>
            )}
            {canWrite && (
              <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(row.original)}>
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  if (authLoading) return null
  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Ticket Priorities</h1>
          <p className="text-sm text-muted-foreground">Each priority carries its own SLA response and resolution targets.</p>
        </div>
        {canWrite && (
          <MagneticButton>
            <Button render={<Link href={toOrgHref("/helpdesk/priorities/add")} />}>Add priority</Button>
          </MagneticButton>
        )}
      </div>

      <DataTable columns={columns} data={data?.items ?? []} isLoading={loading} emptyMessage="No priorities yet." />
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}

      {pendingDelete && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingDelete(null)}
          title={`Delete "${pendingDelete.name}"?`}
          description="This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={() => handleDelete(pendingDelete)}
        />
      )}
    </div>
  )
}
