"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { apiClient, apiErrorMessage } from "@/lib/api-client"

export type HelpdeskPriorityFormValues = {
  _id?: string
  name: string
  order: string
  color: string
  slaResponseMinutes: string
  slaResolutionMinutes: string
}

export const EMPTY_HELPDESK_PRIORITY_FORM: HelpdeskPriorityFormValues = {
  name: "",
  order: "0",
  color: "#0080F0",
  slaResponseMinutes: "60",
  slaResolutionMinutes: "480",
}

// Field-only, Dialog-agnostic - used directly by /helpdesk/priorities/add and
// /helpdesk/priorities/[id]/edit, mirroring asset-form.tsx/license-form.tsx's own shape.
export function HelpdeskPriorityForm({
  initial,
  onSaved,
  onCancel,
}: {
  initial: HelpdeskPriorityFormValues
  onSaved: () => void
  onCancel?: () => void
}) {
  const [form, setForm] = React.useState<HelpdeskPriorityFormValues>(initial)
  const [submitting, setSubmitting] = React.useState(false)

  const isEdit = Boolean(form._id)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!form.name.trim()) {
      toast.error("Name is required")
      return
    }

    const payload = {
      name: form.name,
      order: Number(form.order),
      color: form.color,
      slaResponseMinutes: Number(form.slaResponseMinutes),
      slaResolutionMinutes: Number(form.slaResolutionMinutes),
    }

    setSubmitting(true)
    try {
      if (isEdit && form._id) {
        await apiClient.put(`/helpdesk-priorities/${form._id}`, payload)
        toast.success("Priority updated")
      } else {
        await apiClient.post("/helpdesk-priorities", payload)
        toast.success("Priority created")
      }
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save priority"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label htmlFor="hdpri-name">Name</Label>
        <Input
          id="hdpri-name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          placeholder="e.g. Critical"
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="hdpri-order">Sort order</Label>
          <Input
            id="hdpri-order"
            type="number"
            value={form.order}
            onChange={(e) => setForm((f) => ({ ...f, order: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hdpri-color">Color</Label>
          <Input
            id="hdpri-color"
            type="color"
            value={form.color}
            onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
            className="h-8 p-1"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 border-t pt-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="hdpri-response">SLA response (minutes)</Label>
          <Input
            id="hdpri-response"
            type="number"
            min={1}
            value={form.slaResponseMinutes}
            onChange={(e) => setForm((f) => ({ ...f, slaResponseMinutes: e.target.value }))}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="hdpri-resolution">SLA resolution (minutes)</Label>
          <Input
            id="hdpri-resolution"
            type="number"
            min={1}
            value={form.slaResolutionMinutes}
            onChange={(e) => setForm((f) => ({ ...f, slaResolutionMinutes: e.target.value }))}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Saving..." : isEdit ? "Save changes" : "Create priority"}
        </Button>
      </div>
    </form>
  )
}
