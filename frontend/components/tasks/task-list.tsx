"use client"

import * as React from "react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { TaskFormDialog } from "@/components/tasks/task-form-dialog"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"

const TASK_STATUSES = ["To Do", "In Progress", "Done", "Cancelled"] as const
type TaskStatus = (typeof TASK_STATUSES)[number]

type Task = {
  _id: string
  taskId: string
  title: string
  assignedTo: { _id: string; name: string; email: string } | null
  priority: "Low" | "Medium" | "High" | "Urgent"
  status: TaskStatus
  dueDate: string | null
}

const STATUS_VARIANT: Record<TaskStatus, "secondary" | "default" | "success" | "outline"> = {
  "To Do": "secondary",
  "In Progress": "default",
  Done: "success",
  Cancelled: "outline",
}

/** Compact, embeddable task list - used inside a Helpdesk ticket's detail page (scoped to that
 * ticket's sub-tasks) as well as anywhere else a lightweight "tasks for X" view is useful. The
 * standalone /tasks module page has its own full DataTable-based list instead. */
export function TaskList({ ticketId }: { ticketId: string }) {
  const { user } = useAuth()
  const [tasks, setTasks] = React.useState<Task[]>([])
  const [loading, setLoading] = React.useState(true)
  const [statusChange, setStatusChange] = React.useState<{ task: Task; status: TaskStatus } | null>(null)
  const [reason, setReason] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  const canView = can(user, "tasks", "view")
  const canCreate = can(user, "tasks", "create")
  const canUpdate = can(user, "tasks", "update")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Task[]>>(`/tasks/by-ticket/${ticketId}`)
      setTasks(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load sub-tasks"))
    } finally {
      setLoading(false)
    }
  }, [ticketId])

  React.useEffect(() => {
    if (canView) load()
  }, [canView, load])

  async function confirmStatusChange() {
    if (!statusChange || !reason.trim()) return
    setSubmitting(true)
    try {
      await apiClient.patch(`/tasks/${statusChange.task._id}/status`, { status: statusChange.status, reason: reason.trim() })
      setStatusChange(null)
      setReason("")
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update task status"))
    } finally {
      setSubmitting(false)
    }
  }

  if (!canView) return null

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-muted-foreground">Sub-tasks</h2>
        {canCreate && <TaskFormDialog ticketId={ticketId} onSaved={load} />}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
      {!loading && tasks.length === 0 && <p className="text-sm text-muted-foreground">No sub-tasks yet.</p>}

      {tasks.map((task) => (
        <Card key={task._id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {task.taskId} - {task.title}
              </span>
              <span className="text-xs text-muted-foreground">
                {task.assignedTo?.name ?? "Unassigned"}
                {task.dueDate && ` · Due ${new Date(task.dueDate).toLocaleDateString()}`}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{task.priority}</Badge>
              {/* The backend also lets the task's own assignee change its status without
                  tasks:update (see tasks.controller.ts#setTaskStatus's isOwnTask bypass) - shown
                  here too, not just to callers with the broader update permission. */}
              {canUpdate || task.assignedTo?._id === user?._id ? (
                <Select
                  value={task.status}
                  onValueChange={(v) => v && setStatusChange({ task, status: v as TaskStatus })}
                >
                  <SelectTrigger className="h-7 w-32 text-xs">
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
                <Badge variant={STATUS_VARIANT[task.status]}>{task.status}</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      ))}

      <Dialog open={statusChange !== null} onOpenChange={(open) => !open && setStatusChange(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Mark &quot;{statusChange?.task.title}&quot; as {statusChange?.status}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-status-reason">Reason (required)</Label>
            <Textarea
              id="task-status-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this task's status changing?"
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusChange(null)}>
              Cancel
            </Button>
            <Button onClick={confirmStatusChange} disabled={!reason.trim() || submitting}>
              {submitting ? "Saving..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
