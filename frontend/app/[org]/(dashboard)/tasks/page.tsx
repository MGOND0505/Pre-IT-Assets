"use client"

import * as React from "react"
import Link from "next/link"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { MagneticButton } from "@/components/ui/magnetic-button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
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
  lastRemark: string
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
  const canUpdate = can(user, "tasks", "update")

  const [statusChange, setStatusChange] = React.useState<{ task: Task; status: TaskStatus } | null>(null)
  const [reason, setReason] = React.useState("")
  const [submittingStatus, setSubmittingStatus] = React.useState(false)

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

  async function confirmStatusChange() {
    if (!statusChange || !reason.trim()) return
    setSubmittingStatus(true)
    try {
      await apiClient.patch(`/tasks/${statusChange.task._id}/status`, { status: statusChange.status, reason: reason.trim() })
      setStatusChange(null)
      setReason("")
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update task status"))
    } finally {
      setSubmittingStatus(false)
    }
  }

  const columns: ColumnDef<Task, unknown>[] = [
    {
      accessorKey: "taskId",
      header: "Task",
      cell: ({ row }) => (
        <span title={row.original.taskId} className="block min-w-[90px] max-w-[110px] whitespace-normal break-words">
          {row.original.taskId}
        </span>
      ),
    },
    {
      accessorKey: "title",
      header: "Title",
      cell: ({ row }) => (
        <span title={row.original.title} className="block min-w-[180px] max-w-[280px] whitespace-normal break-words">
          {row.original.title}
        </span>
      ),
    },
    {
      id: "assignee",
      header: "Assigned To",
      meta: { hideBelow: "md" },
      cell: ({ row }) => (
        <span title={row.original.assignedTo?.name} className="block min-w-[100px] max-w-[140px] whitespace-normal break-words">
          {row.original.assignedTo?.name ?? "Unassigned"}
        </span>
      ),
    },
    {
      accessorKey: "priority",
      header: "Priority",
      meta: { hideBelow: "sm" },
      cell: ({ row }) => <Badge variant="outline">{row.original.priority}</Badge>,
    },
    {
      id: "dueDate",
      header: "Due",
      cell: ({ row }) => (row.original.dueDate ? new Date(row.original.dueDate).toLocaleDateString() : "-"),
    },
    {
      id: "status",
      header: "Status",
      // The backend also lets a task's own assignee change its status without tasks:update (see
      // tasks.controller.ts#setTaskStatus's isOwnTask bypass) - shown here too, not just to
      // callers with the broader update permission. Mirrors components/tasks/task-list.tsx's
      // identical control for the ticket-embedded sub-task view.
      cell: ({ row }) =>
        canUpdate || row.original.assignedTo?._id === user?._id ? (
          <Select
            value={row.original.status}
            onValueChange={(v) => v && setStatusChange({ task: row.original, status: v as TaskStatus })}
          >
            <SelectTrigger className="h-8 w-32 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Badge variant={STATUS_VARIANT[row.original.status]}>{row.original.status}</Badge>
        ),
    },
    {
      id: "remarks",
      header: "Remarks",
      meta: { hideBelow: "lg" },
      cell: ({ row }) => (
        <span
          title={row.original.lastRemark}
          className="block min-w-[140px] max-w-[240px] whitespace-normal break-words text-muted-foreground"
        >
          {row.original.lastRemark || "-"}
        </span>
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
          <h1 className="text-2xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground">Track work assigned to you and your team.</p>
        </div>
        {canCreate && (
          <MagneticButton>
            <Button render={<Link href={toOrgHref("/tasks/add")} />}>Add Task</Button>
          </MagneticButton>
        )}
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

      <Dialog open={statusChange !== null} onOpenChange={(open) => !open && setStatusChange(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mark &quot;{statusChange?.task.title}&quot; as {statusChange?.status}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-status-remark">Remarks (required)</Label>
            <Textarea
              id="task-status-remark"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Add a response for this status change..."
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusChange(null)}>
              Cancel
            </Button>
            <Button onClick={confirmStatusChange} disabled={!reason.trim() || submittingStatus}>
              {submittingStatus ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
