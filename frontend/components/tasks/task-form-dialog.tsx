"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { useUserOptions } from "@/lib/use-lookup-options"

const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const

export function TaskFormDialog({
  ticketId,
  onSaved,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  /** When set, the created task is a sub-task of this ticket rather than a standalone task. */
  ticketId?: string
  onSaved: () => void
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange! : setInternalOpen

  const { items: users } = useUserOptions()

  const [title, setTitle] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [assignedTo, setAssignedTo] = React.useState("")
  const [dueDate, setDueDate] = React.useState("")
  const [priority, setPriority] = React.useState<(typeof TASK_PRIORITIES)[number]>("Medium")
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setTitle("")
      setDescription("")
      setAssignedTo("")
      setDueDate("")
      setPriority("Medium")
    }
  }, [open])

  async function handleSave() {
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
        ticket: ticketId,
      })
      toast.success(ticketId ? "Sub-task added" : "Task created")
      setOpen(false)
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save task"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && <DialogTrigger render={trigger ?? <Button>{ticketId ? "Add sub-task" : "Add Task"}</Button>} />}
      <DialogContent size="full">
        <DialogHeader>
          <DialogTitle>{ticketId ? "Add sub-task" : "Add task"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-title">Title</Label>
            <Input id="task-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="task-description">Description</Label>
            <Textarea id="task-description" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : ticketId ? "Add sub-task" : "Create task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
