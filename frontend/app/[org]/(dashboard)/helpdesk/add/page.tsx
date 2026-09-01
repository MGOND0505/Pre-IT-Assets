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
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useHelpdeskCategoryOptions, useHelpdeskPriorityOptions } from "@/lib/use-lookup-options"
import { useOrgHref } from "@/lib/use-org-href"

export default function AddTicketPage() {
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const { items: categories } = useHelpdeskCategoryOptions()
  const { items: priorities } = useHelpdeskPriorityOptions()

  const [subject, setSubject] = React.useState("")
  const [description, setDescription] = React.useState("")
  const [category, setCategory] = React.useState("")
  const [priority, setPriority] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  const canCreate = can(user, "helpdesk", "create")

  async function handleSubmit() {
    if (!subject.trim()) {
      toast.error("Subject is required")
      return
    }
    if (!priority) {
      toast.error("Choose a priority")
      return
    }
    setSubmitting(true)
    try {
      const res = await apiClient.post<ApiEnvelope<{ _id: string }>>("/helpdesk", {
        subject,
        description,
        category: category || undefined,
        priority,
      })
      toast.success("Ticket created")
      router.push(toOrgHref(`/helpdesk/${res.data.data._id}`))
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not create ticket"))
    } finally {
      setSubmitting(false)
    }
  }

  if (authLoading) return null
  if (!canCreate) {
    return <p className="text-sm text-muted-foreground">You do not have permission to create tickets.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Add Ticket</h1>
        <p className="text-sm text-muted-foreground">Submit a new support request.</p>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ticket-subject">Subject</Label>
            <Input id="ticket-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ticket-description">Description</Label>
            <Textarea
              id="ticket-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-32"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="ticket-category">Category</Label>
              <Select value={category} onValueChange={(v) => setCategory(v ?? "")}>
                <SelectTrigger id="ticket-category">
                  <SelectValue placeholder="Choose a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="ticket-priority">Priority</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v ?? "")}>
                <SelectTrigger id="ticket-priority">
                  <SelectValue placeholder="Choose a priority" />
                </SelectTrigger>
                <SelectContent>
                  {priorities.map((p) => (
                    <SelectItem key={p._id} value={p._id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Submitting..." : "Submit ticket"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
