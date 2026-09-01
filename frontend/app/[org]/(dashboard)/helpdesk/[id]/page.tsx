"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import { Download, Paperclip } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { TicketStatusBadge, TICKET_STATUSES, type TicketStatus } from "@/components/helpdesk/ticket-status-badge"
import { TicketAssignmentHistory } from "@/components/helpdesk/ticket-assignment-history"
import { TaskList } from "@/components/tasks/task-list"
import { apiClient, apiErrorMessage, orgScopedApiUrl, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useUserOptions } from "@/lib/use-lookup-options"
import { useOrgHref } from "@/lib/use-org-href"

type Ticket = {
  _id: string
  ticketId: string
  subject: string
  description: string
  category: { _id: string; name: string } | null
  priority: { _id: string; name: string; color: string } | null
  requester: { _id: string; name: string; email: string } | null
  department: { _id: string; name: string } | null
  location: { _id: string; name: string } | null
  assignedAgent: { _id: string; name: string; email: string } | null
  tier: "L1" | "L2" | "L3"
  status: TicketStatus
  resolution: string
  reopenCount: number
  slaResponseDueAt: string | null
  slaResolutionDueAt: string | null
  slaResolutionBreached: boolean
  createdDate: string
}

type Comment = {
  _id: string
  author: { _id: string; name: string; email: string } | null
  body: string
  isInternal: boolean
  attachments: { fileName: string; storedName: string; size: number }[]
  createdDate: string
}

export default function TicketDetailPage() {
  const params = useParams<{ org: string; id: string }>()
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user } = useAuth()
  const { items: users } = useUserOptions()

  const [ticket, setTicket] = React.useState<Ticket | null>(null)
  const [comments, setComments] = React.useState<Comment[]>([])
  const [loading, setLoading] = React.useState(true)
  const [resolution, setResolution] = React.useState("")
  const [pendingStatus, setPendingStatus] = React.useState<TicketStatus | "">("")
  const [assigneeId, setAssigneeId] = React.useState("")
  const [commentBody, setCommentBody] = React.useState("")
  const [isInternal, setIsInternal] = React.useState(false)
  const [files, setFiles] = React.useState<FileList | null>(null)
  const [submitting, setSubmitting] = React.useState(false)
  const [historyRefreshKey, setHistoryRefreshKey] = React.useState(0)

  const canUpdate = can(user, "helpdesk", "update")
  const canAssign = can(user, "helpdesk", "assign")
  const canReassign = can(user, "helpdesk", "reassign")
  const canComment = can(user, "helpdesk", "comment")
  const canInternalNote = can(user, "helpdesk", "internalNote")
  const canAttach = can(user, "helpdesk", "manageAttachments")
  const canClose = can(user, "helpdesk", "close")
  const canReopen = can(user, "helpdesk", "reopen")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [ticketRes, commentsRes] = await Promise.all([
        apiClient.get<ApiEnvelope<Ticket>>(`/helpdesk/${params.id}`),
        apiClient.get<ApiEnvelope<Comment[]>>(`/helpdesk/${params.id}/comments`),
      ])
      setTicket(ticketRes.data.data)
      setComments(commentsRes.data.data)
      setAssigneeId(ticketRes.data.data.assignedAgent?._id ?? "")
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load ticket"))
    } finally {
      setLoading(false)
    }
  }, [params.id])

  React.useEffect(() => {
    load()
  }, [load])

  async function handleStatusChange(status: TicketStatus) {
    if (status === "Closed" && !user?.isAdmin && !canClose) {
      toast.error("You do not have permission to close this ticket")
      return
    }
    if (status === "Reopened" && !user?.isAdmin && !canReopen) {
      toast.error("You do not have permission to reopen this ticket")
      return
    }
    try {
      await apiClient.patch(`/helpdesk/${params.id}/status`, { status, resolution: resolution || undefined })
      toast.success(`Ticket marked ${status}`)
      setPendingStatus("")
      setResolution("")
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update ticket status"))
    }
  }

  async function handleAssign() {
    if (!assigneeId) return
    try {
      await apiClient.patch(`/helpdesk/${params.id}/assign`, { agentId: assigneeId })
      toast.success("Ticket assigned")
      load()
      setHistoryRefreshKey((k) => k + 1)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not assign ticket"))
    }
  }

  async function handleAddComment() {
    if (!commentBody.trim()) {
      toast.error("Comment cannot be empty")
      return
    }
    setSubmitting(true)
    try {
      const formData = new FormData()
      formData.append("body", commentBody)
      formData.append("isInternal", String(isInternal))
      if (files) {
        for (const file of Array.from(files)) formData.append("attachments", file)
      }
      await apiClient.post(`/helpdesk/${params.id}/comments`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      toast.success("Comment added")
      setCommentBody("")
      setIsInternal(false)
      setFiles(null)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not add comment"))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading || !ticket) return null

  const canAssignOrReassign = ticket.assignedAgent ? canReassign : canAssign

  return (
    <div className="flex flex-col gap-6">
      <div className="text-sm text-muted-foreground">
        <a href="#" className="hover:underline" onClick={(e) => { e.preventDefault(); router.push(toOrgHref("/helpdesk")) }}>
          Helpdesk
        </a>{" "}
        / {ticket.ticketId}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {ticket.ticketId} - {ticket.subject}
          </h1>
          <p className="text-sm text-muted-foreground">
            Requested by {ticket.requester?.name ?? "Unknown"} &middot; {new Date(ticket.createdDate).toLocaleString()}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <TicketStatusBadge status={ticket.status} />
          <Badge variant="outline">{ticket.tier}</Badge>
          {ticket.slaResolutionBreached && <Badge variant="destructive">SLA Breached</Badge>}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card>
            <CardContent className="flex flex-col gap-4 pt-6">
              <div>
                <div className="text-xs text-muted-foreground">Description</div>
                <p className="text-sm whitespace-pre-wrap">{ticket.description || "-"}</p>
              </div>
              {ticket.resolution && (
                <div>
                  <div className="text-xs text-muted-foreground">Resolution</div>
                  <p className="text-sm whitespace-pre-wrap">{ticket.resolution}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <TaskList ticketId={ticket._id} />

          <TicketAssignmentHistory key={historyRefreshKey} ticketId={ticket._id} />

          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Comments &amp; Activity</h2>
            {comments.length === 0 && <p className="text-sm text-muted-foreground">No comments yet.</p>}
            {comments.map((c) => (
              <Card key={c._id} className={c.isInternal ? "border-warning/40 bg-warning/5" : undefined}>
                <CardContent className="flex flex-col gap-2 pt-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-medium">{c.author?.name ?? "Unknown"}</span>
                    <div className="flex items-center gap-2">
                      {c.isInternal && <Badge variant="warning">Internal Note</Badge>}
                      <span className="text-xs text-muted-foreground">{new Date(c.createdDate).toLocaleString()}</span>
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{c.body}</p>
                  {c.attachments.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {c.attachments.map((a) => (
                        <a
                          key={a.storedName}
                          href={orgScopedApiUrl(`/helpdesk/${ticket._id}/attachments/${a.storedName}/download`)}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 rounded-md border px-2 py-1 text-xs text-primary hover:underline"
                        >
                          <Paperclip className="size-3" /> {a.fileName} <Download className="size-3" />
                        </a>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}

            {canComment && (
              <Card>
                <CardContent className="flex flex-col gap-3 pt-4">
                  <Textarea
                    placeholder="Add a comment..."
                    value={commentBody}
                    onChange={(e) => setCommentBody(e.target.value)}
                  />
                  <div className="flex flex-wrap items-center gap-3">
                    {canAttach && (
                      <input
                        type="file"
                        multiple
                        onChange={(e) => setFiles(e.target.files)}
                        className="text-xs text-muted-foreground"
                      />
                    )}
                    {canInternalNote && (
                      <label className="flex items-center gap-2 text-sm">
                        <Checkbox checked={isInternal} onCheckedChange={(v) => setIsInternal(v === true)} />
                        Internal note (not visible to requester)
                      </label>
                    )}
                  </div>
                  <div>
                    <Button onClick={handleAddComment} disabled={submitting}>
                      {submitting ? "Posting..." : "Add comment"}
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
                <div className="text-xs text-muted-foreground">Priority</div>
                <div className="flex items-center gap-1.5">
                  {ticket.priority && <span className="size-2 rounded-full" style={{ backgroundColor: ticket.priority.color }} />}
                  {ticket.priority?.name ?? "-"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Category</div>
                {ticket.category?.name ?? "-"}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Department</div>
                {ticket.department?.name ?? "-"}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Location</div>
                {ticket.location?.name ?? "-"}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">SLA Response Due</div>
                {ticket.slaResponseDueAt ? new Date(ticket.slaResponseDueAt).toLocaleString() : "-"}
              </div>
              <div>
                <div className="text-xs text-muted-foreground">SLA Resolution Due</div>
                {ticket.slaResolutionDueAt ? new Date(ticket.slaResolutionDueAt).toLocaleString() : "-"}
              </div>
              {ticket.reopenCount > 0 && (
                <div>
                  <div className="text-xs text-muted-foreground">Reopened</div>
                  {ticket.reopenCount} time(s)
                </div>
              )}
            </CardContent>
          </Card>

          {canAssignOrReassign && (
            <Card>
              <CardContent className="flex flex-col gap-3 pt-6">
                <Label htmlFor="assignee">{ticket.assignedAgent ? "Reassign to" : "Assign to"}</Label>
                <Select value={assigneeId} onValueChange={(v) => setAssigneeId(v ?? "")}>
                  <SelectTrigger id="assignee">
                    <SelectValue placeholder="Choose an agent" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((u) => (
                      <SelectItem key={u._id} value={u._id}>
                        {u.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={handleAssign} disabled={!assigneeId}>
                  {ticket.assignedAgent ? "Reassign" : "Assign"}
                </Button>
                {ticket.assignedAgent && (
                  <p className="text-xs text-muted-foreground">Currently assigned to {ticket.assignedAgent.name}.</p>
                )}
              </CardContent>
            </Card>
          )}

          {canUpdate && (
            <Card>
              <CardContent className="flex flex-col gap-3 pt-6">
                <Label htmlFor="status">Change status</Label>
                <Select value={pendingStatus} onValueChange={(v) => setPendingStatus((v as TicketStatus) ?? "")}>
                  <SelectTrigger id="status">
                    <SelectValue placeholder="Choose a status" />
                  </SelectTrigger>
                  <SelectContent>
                    {TICKET_STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(pendingStatus === "Resolved" || pendingStatus === "Closed") && (
                  <Textarea
                    placeholder="Resolution notes"
                    value={resolution}
                    onChange={(e) => setResolution(e.target.value)}
                  />
                )}
                <Button onClick={() => pendingStatus && handleStatusChange(pendingStatus)} disabled={!pendingStatus}>
                  Update status
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
