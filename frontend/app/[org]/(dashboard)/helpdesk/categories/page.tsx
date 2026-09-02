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

type HelpdeskCategory = {
  _id: string
  name: string
  description: string
  defaultAgent: { _id: string; name: string } | null
  status: "Active" | "Inactive"
}

type Paginated = { items: HelpdeskCategory[]; total: number; page: number; totalPages: number }

export default function HelpdeskCategoriesPage() {
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = React.useState<Paginated | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [pendingDelete, setPendingDelete] = React.useState<HelpdeskCategory | null>(null)

  const canView = can(user, "helpdesk", "view")
  const canWrite = Boolean(user?.isAdmin)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Paginated>>("/helpdesk-categories", { params: { page, limit: 20 } })
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load categories"))
    } finally {
      setLoading(false)
    }
  }, [page])

  React.useEffect(() => {
    if (canView) load()
  }, [canView, load])

  async function handleDelete(category: HelpdeskCategory) {
    try {
      await apiClient.delete(`/helpdesk-categories/${category._id}`)
      toast.success(`${category.name} deleted`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete category"))
    } finally {
      setPendingDelete(null)
    }
  }

  const columns: ColumnDef<HelpdeskCategory, unknown>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "description", header: "Description" },
    {
      id: "defaultAgent",
      header: "Default Agent",
      cell: ({ row }) => row.original.defaultAgent?.name ?? "-",
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
              <DropdownMenuItem render={<Link href={toOrgHref(`/helpdesk/categories/${row.original._id}/edit`)} />}>
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
          <h1 className="text-2xl font-semibold tracking-tight">Ticket Categories</h1>
          <p className="text-sm text-muted-foreground">Group tickets by category, each with its own default agent for auto-assignment.</p>
        </div>
        {canWrite && (
          <MagneticButton>
            <Button render={<Link href={toOrgHref("/helpdesk/categories/add")} />}>Add category</Button>
          </MagneticButton>
        )}
      </div>

      <DataTable columns={columns} data={data?.items ?? []} isLoading={loading} emptyMessage="No categories yet." />
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
