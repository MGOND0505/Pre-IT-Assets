"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { TaskAssignmentHistory } from "@/components/tasks/task-assignment-history"
import { TaskAttachmentsTab } from "@/components/tasks/task-attachments-tab"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useUserOptions } from "@/lib/use-lookup-options"
import { useOrgHref } from "@/lib/use-org-href"

const TASK_STATUSES = ["To Do", "In Progress", "Done", "Cancelled"] as const
type TaskStatus = (typeof TASK_STATUSES)[number]

const STATUS_VARIANT: Record<TaskStatus, "secondary" | "default" | "success" | "outline"> = {
  "To Do": "secondary",
  "In Progress": "default",
  Done: "success",
  Cancelled: "outline",
}

type Task = {
  _id: string
  taskId: string
  title: string
  description: string
  assignedTo: { _id: string; name: string; email: string } | null
  assignedBy: { _id: string; name: string; email: string } | null
  assignedDate: string | null
  dueDate: string | null
  priority: "Low" | "Medium" | "High" | "Urgent"
  status: TaskStatus
  lastRemark: string
  ticket: { _id: string; ticketId: string; subject: string } | null
  createdDate: string
}

type Comment = {
  _id: string
  author: { _id: string; name: string; email: string } | null
  body: string
  createdDate: string
}

export default function TaskDetailPage() {
  const params = useParams<{ org: string; id: string }>()
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user } = useAuth()
  const { items: users } = useUserOptions()

  const [task, setTask] = React.useState<Task | null>(null)
  const [comments, setComments] = React.useState<Comment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [historyRefreshKey, setHistoryRefreshKey] = React.useState(0)

  const [assigneeId, setAssigneeId] = React.useState("")
  const [reassignReason, setReassignReason] = React.useState("")
  const [reassigning, setReassigning] = React.useState(false)

  const [pendingStatus, setPendingStatus] = React.useState<TaskStatus | "">("")
  const [statusReason, setStatusReason] = React.useState("")
  const [changingStatus, setChangingStatus] = React.useState(false)

  const [commentBody, setCommentBody] = React.useState("")
  const [submittingComment, setSubmittingComment] = React.useState(false)

  const canUpdate = can(user, "tasks", "update")
  const canAssign = can(user, "tasks", "assign")
  const canComment = can(user, "tasks", "comment")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [taskRes, commentsRes] = await Promise.all([
        apiClient.get<ApiEnvelope<Task>>(`/tasks/${params.id}`),
        apiClient.get<ApiEnvelope<Comment[]>>(`/tasks/${params.id}/comments`),
      ])
      setTask(taskRes.data.data)
      setComments(commentsRes.data.data)
      setAssigneeId(taskRes.data.data.assignedTo?._id ?? "")
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load task"))
    } finally {
      setLoading(false)
    }
  }, [params.id])

  React.useEffect(() => {
    load()
  }, [load])

  async function handleReassign() {
    if (!assigneeId || !reassignReason.trim()) {
      toast.error("Choose an assignee and enter a reason")
      return
    }
    setReassigning(true)
    try {
      await apiClient.patch(`/tasks/${params.id}/assign`, { assigneeId, reason: reassignReason.trim() })
      toast.success("Task reassigned")
      setReassignReason("")
      load()
      setHistoryRefreshKey((k) => k + 1)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not reassign task"))
    } finally {
      setReassigning(false)
    }
  }

  async function handleStatusChange() {
    if (!pendingStatus || !statusReason.trim()) {
      toast.error("Choose a status and enter a remark")
      return
    }
    setChangingStatus(true)
    try {
      await apiClient.patch(`/tasks/${params.id}/status`, { status: pendingStatus, reason: statusReason.trim() })
      toast.success(`Task marked ${pendingStatus}`)
      setPendingStatus("")
      setStatusReason("")
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update task status"))
    } finally {
      setChangingStatus(false)
    }
  }

  async function handleAddComment() {
    if (!commentBody.trim()) {
      toast.error("Comment cannot be empty")
      return
    }
    setSubmittingComment(true)
    try {
      await apiClient.post(`/tasks/${params.id}/comments`, { body: commentBody.trim() })
      toast.success("Comment added")
      setCommentBody("")
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not add comment"))
    } finally {
      setSubmittingComment(false)
    }
  }

  if (loading || !task) return null

  const isOwnTask = task.assignedTo?._id === user?._id
  const canChangeStatus = canUpdate || isOwnTask

  return (
    <div className="flex flex-col gap-6">
      <div className="text-sm text-muted-foreground">
        <a
          href="#"
          className="hover:underline"
          onClick={(e) => {
            e.preventDefault()
            router.push(toOrgHref("/tasks"))
          }}
        >
          Tasks
        </a>{" "}
        / {task.taskId}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {task.taskId} - {task.title}
          </h1>
          <p className="text-sm text-muted-foreground">Created {new Date(task.createdDate).toLocaleString()}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={STATUS_VARIANT[task.status]}>{task.status}</Badge>
          <Badge variant="outline">{task.priority}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div>
                <div className="text-xs text-muted-foreground">Description</div>
                <p className="text-sm whitespace-pre-wrap">{task.description || "-"}</p>
              </div>
              {task.lastRemark && (
                <div>
                  <div className="text-xs text-muted-foreground">Latest remark</div>
                  <p className="text-sm whitespace-pre-wrap">{task.lastRemark}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <TaskAssignmentHistory key={historyRefreshKey} taskId={task._id} />

          <TaskAttachmentsTab taskId={task._id} />

          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Comments</h2>
            {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
            {comments.map((c) => (
              <Card key={c._id}>
                <CardContent className="flex flex-col gap-2 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{c.author?.name ?? "Unknown"}</span>
                    <span className="text-xs text-muted-foreground">{new Date(c.createdDate).toLocaleString()}</span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                </CardContent>
              </Card>
            ))}

            {canComment && (
              <Card>
                <CardContent className="flex flex-col gap-3 pt-4">
                  <Textarea placeholder="Add a comment..." value={commentBody} onChange={(e) => setCommentBody(e.target.value)} />
                  <div>
                    <Button onClick={handleAddComment} disabled={submittingComment}>
                      {submittingComment ? "Posting..." : "Add comment"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Card>
            <CardContent className="flex flex-col gap-3 pt-6 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Assigned to</div>
                {task.assignedTo?.name ?? "Unassigned"}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Assigned by</div>
                {task.assignedBy?.name ?? "-"}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Assigned date</div>
                {task.assignedDate ? new Date(task.assignedDate).toLocaleString() : "-"}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Due date</div>
                {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "-"}
              </div>
              {task.ticket && (
                <div>
                  <div className="text-xs text-muted-foreground">Linked ticket</div>
                  <a
                    href="#"
                    className="text-primary hover:underline"
                    onClick={(e) => {
                      e.preventDefault()
                      router.push(toOrgHref(`/helpdesk/${task.ticket!._id}`))
                    }}
                  >
                    {task.ticket.ticketId} - {task.ticket.subject}
                  </a>
                </div>
              )}
            </CardContent>
          </Card>

          {canAssign && (
            <Card>
              <CardContent className="flex flex-col gap-3 pt-6">
                <Label htmlFor="task-reassign">{task.assignedTo ? "Reassign to" : "Assign to"}</Label>
                <Select value={assigneeId} onValueChange={(v) => setAssigneeId(v ?? "")}>
                  <SelectTrigger id="task-reassign">
                    <SelectValue placeholder="Choose a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u._id} value={u._id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Reason for (re)assignment"
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                />
                <Button onClick={handleReassign} disabled={!assigneeId || !reassignReason.trim() || reassigning}>
                  {reassigning ? "Saving..." : task.assignedTo ? "Reassign" : "Assign"}
                </Button>
              </CardContent>
            </Card>
          )}

          {canChangeStatus && (
            <Card>
              <CardContent className="flex flex-col gap-3 pt-6">
                <Label htmlFor="task-status">Change status</Label>
                <Select value={pendingStatus} onValueChange={(v) => setPendingStatus((v as TaskStatus) ?? "")}>
                  <SelectTrigger id="task-status">
                    <SelectValue placeholder="Choose a status" />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea placeholder="Remarks (required)" value={statusReason} onChange={(e) => setStatusReason(e.target.value)} />
                <Button onClick={handleStatusChange} disabled={!pendingStatus || !statusReason.trim() || changingStatus}>
                  {changingStatus ? "Saving..." : "Update status"}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
