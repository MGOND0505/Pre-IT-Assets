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
import { type KnowledgeBaseArticle } from "@/components/knowledge-base/knowledge-base-article-form"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

type Paginated = { items: KnowledgeBaseArticle[]; total: number; page: number; totalPages: number }

export default function KnowledgeBasePage() {
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = React.useState<Paginated | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [pendingDelete, setPendingDelete] = React.useState<KnowledgeBaseArticle | null>(null)

  const canView = can(user, "knowledgeBase", "view")
  const canCreate = can(user, "knowledgeBase", "create")
  const canWrite = can(user, "knowledgeBase", "update")
  const canDelete = can(user, "knowledgeBase", "delete")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Paginated>>("/knowledge-base", { params: { page, limit: 10 } })
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load knowledge base articles"))
    } finally {
      setLoading(false)
    }
  }, [page])

  React.useEffect(() => {
    if (canView) load()
  }, [canView, load])

  async function handleDelete(article: KnowledgeBaseArticle) {
    try {
      await apiClient.delete(`/knowledge-base/${article._id}`)
      toast.success(`${article.title} deleted`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete article"))
    } finally {
      setPendingDelete(null)
    }
  }

  const columns: ColumnDef<KnowledgeBaseArticle, unknown>[] = [
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <span title={row.original.title} className="block min-w-[140px] max-w-[240px] whitespace-normal break-words">
          {row.original.title}
        </span>
      ),
    },
    {
      id: "category",
      header: "Category",
      meta: { hideBelow: "md" },
      cell: ({ row }) => <span>{row.original.category?.name ?? "-"}</span>,
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "Published" ? "default" : "secondary"}>{row.original.status}</Badge>
      ),
    },
    {
      id: "tags",
      header: "Tags",
      meta: { hideBelow: "md" },
      cell: ({ row }) => (
        <div className="flex max-w-[240px] flex-wrap gap-1">
          {row.original.tags.length > 0
            ? row.original.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))
            : "-"}
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
            {canWrite && (
              <DropdownMenuItem render={<Link href={toOrgHref(`/knowledge-base/${row.original._id}/edit`)} />}>
                Edit
              </DropdownMenuItem>
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

  if (authLoading) return null
  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Knowledge Base</h1>
          <p className="text-sm text-muted-foreground">Manage the help articles used to assist users and the AI Assistant.</p>
        </div>
        {canCreate && (
          <MagneticButton>
            <Button render={<Link href={toOrgHref("/knowledge-base/add")} />}>Add article</Button>
          </MagneticButton>
        )}
      </div>

      <DataTable columns={columns} data={data?.items ?? []} isLoading={loading} emptyMessage="No articles yet." />
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}

      {pendingDelete && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingDelete(null)}
          title={`Delete "${pendingDelete.title}"?`}
          description="This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={() => handleDelete(pendingDelete)}
        />
      )}
    </div>
  )
}
