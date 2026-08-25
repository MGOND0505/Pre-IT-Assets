"use client"

import * as React from "react"
import Link from "next/link"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/common/data-table"
import { Pagination } from "@/components/common/pagination"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

const TASK_STATUSES = ["To Do", "In Progress", "Done", "Cancelled"] as const
type TaskStatus = (typeof TASK_STATUSES)[number]
const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const

type Task = {
  _id: string
  taskId: string
  title: string
  assignedTo: { _id: string; name: string; email: string } | null
  priority: (typeof TASK_PRIORITIES)[number]
  status: TaskStatus
  dueDate: string | null
}

type Paginated = { items: Task[]; total: number; page: number; totalPages: number }

const ALL = "__all__"

const STATUS_VARIANT: Record<TaskStatus, "secondary" | "default" | "success" | "outline"> = {
  "To Do": "secondary",
  "In Progress": "default",
  Done: "success",
  Cancelled: "outline",
}

export default function TasksPage() {
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const [data, setData] = React.useState<Paginated | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<string>(ALL)
  const [priority, setPriority] = React.useState<string>(ALL)

  const canView = can(user, "tasks", "view")
  const canCreate = can(user, "tasks", "create")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Paginated>>("/tasks", {
        params: {
          page,
          limit: 20,
          search: search || undefined,
          status: status === ALL ? undefined : status,
          priority: priority === ALL ? undefined : priority,
        },
      })
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load tasks"))
    } finally {
      setLoading(false)
    }
  }, [page, search, status, priority])

  React.useEffect(() => {
    if (canView) load()
  }, [canView, load])

  const columns: ColumnDef<Task, unknown>[] = [
    { accessorKey: "taskId", header: "Task" },
    { accessorKey: "title", header: "Title" },
    { id: "assignee", header: "Assigned To", cell: ({ row }) => row.original.assignedTo?.name ?? "Unassigned" },
    { accessorKey: "priority", header: "Priority", cell: ({ row }) => <Badge variant="outline">{row.original.priority}</Badge> },
    {
      id: "dueDate",
      header: "Due",
      cell: ({ row }) => (row.original.dueDate ? new Date(row.original.dueDate).toLocaleDateString() : "-"),
    },
    {
      id: "status",
      header: "Status",
      cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge>,
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
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">Track work assigned to you and your team.</p>
        </div>
        {canCreate && <Button render={<Link href={toOrgHref("/tasks/add")} />}>Add Task</Button>}
      </div>

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <Input
          placeholder="Search by title..."
          value={search}
          onChange={(e) => {
            setPage(1)
            setSearch(e.target.value)
          }}
          className="w-full md:max-w-sm"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setPage(1)
            setStatus(v ?? ALL)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {TASK_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={priority}
          onValueChange={(v) => {
            setPage(1)
            setPriority(v ?? ALL)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All priorities</SelectItem>
            {TASK_PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable columns={columns} data={data?.items ?? []} isLoading={loading} emptyMessage="No tasks yet." />
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}
    </div>
  )
}
