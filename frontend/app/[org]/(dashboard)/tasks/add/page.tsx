"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useUserOptions } from "@/lib/use-lookup-options"
import { useOrgHref } from "@/lib/use-org-href"

const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const

export default function AddTaskPage() {
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const { items: users } = useUserOptions()

  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [assignedTo, setAssignedTo] = React.useState("")
  const [dueDate, setDueDate] = React.useState("")
  const [priority, setPriority] = React.useState<(typeof TASK_PRIORITIES)[number]>("Medium")
  const [submitting, setSubmitting] = React.useState(false)

  const canCreate = can(user, "tasks", "create")

  async function handleSubmit() {
    if (!title.trim()) {
      toast.error("Title is required")
      return
    }
    if (!assignedTo) {
      toast.error("Choose an assignee")
      return
    }
    setSubmitting(true)
    try {
      await apiClient.post("/tasks", {
        title,
        description,
        assignedTo,
        dueDate: dueDate || undefined,
        priority,
      })
      toast.success("Task created")
      router.push(toOrgHref("/tasks"))
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not create task"))
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) return null
  if (!canCreate) {
    return <p className="text-sm text-muted-foreground">You do not have permission to create tasks.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Task</h1>
        <p className="text-sm text-muted-foreground">Assign a new work item.</p>
      </div>

      <Card className="max-w-2xl">
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea
              id="task-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-32"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-assignee">Assign to</Label>
              <Select value={assignedTo} onValueChange={(v) => setAssignedTo(v ?? "")}>
                <SelectTrigger id="task-assignee">
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
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="task-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => v && setPriority(v as (typeof TASK_PRIORITIES)[number])}>
                <SelectTrigger id="task-priority">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-due">Due date</Label>
            <Input id="task-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting..." : "Create task"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
