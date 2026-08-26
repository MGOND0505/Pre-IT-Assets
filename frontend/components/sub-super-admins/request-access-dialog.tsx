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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ModulePermissionGrid, emptyPermissions } from "@/components/users/permission-grid"
import type { PermissionsShape } from "@/lib/permissions"
import { apiClient, apiErrorMessage } from "@/lib/api-client"

type BrowsableOrganization = { _id: string; name: string; slug: string }

export function RequestAccessDialog({
  organizations,
  onRequested,
}: {
  organizations: BrowsableOrganization[]
  onRequested: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [organizationId, setOrganizationId] = React.useState("")
  const [permissions, setPermissions] = React.useState<PermissionsShape>(emptyPermissions())
  const [reason, setReason] = React.useState("")
  const [submitting, setSubmitting] = React.useState(false)

  function reset() {
    setOrganizationId("")
    setPermissions(emptyPermissions())
    setReason("")
  }

  async function handleSubmit() {
    if (!organizationId) {
      toast.error("Choose an organization")
      return
    }
    setSubmitting(true)
    try {
      await apiClient.post("/access-requests", {
        organization: organizationId,
        requestedPermissions: permissions,
        reason: reason || undefined,
      })
      toast.success("Access request submitted")
      reset()
      setOpen(false)
      onRequested()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not submit access request"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline">Request Access</Button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Request organization access</DialogTitle>
        </DialogHeader>
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="access-request-org">Organization</Label>
            <Select value={organizationId} onValueChange={(v) => setOrganizationId(v ?? "")}>
              <SelectTrigger id="access-request-org">
                <SelectValue placeholder="Choose an organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org._id} value={org._id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="access-request-reason">Reason (optional)</Label>
            <Textarea id="access-request-reason" value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Requested access</p>
            <ModulePermissionGrid permissions={permissions} onPermissionsChange={setPermissions} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={submitting}>
            {submitting ? "Submitting..." : "Submit request"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
