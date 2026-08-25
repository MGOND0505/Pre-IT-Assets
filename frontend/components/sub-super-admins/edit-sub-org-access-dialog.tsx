"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { OrgAccessEditor, type OrgAccessEntry, type OrgOption } from "@/components/sub-super-admins/org-access-editor"
import { apiClient, apiErrorMessage } from "@/lib/api-client"

export function EditSubOrgAccessDialog({
  open,
  onOpenChange,
  subSuperAdminId,
  subSuperAdminEmail,
  organizations,
  currentAccess,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  subSuperAdminId: string
  subSuperAdminEmail: string
  organizations: OrgOption[]
  currentAccess: OrgAccessEntry[]
  onSaved: () => void
}) {
  const [orgAccess, setOrgAccess] = React.useState<OrgAccessEntry[]>(currentAccess)
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) setOrgAccess(currentAccess)
  }, [open, currentAccess])

  async function handleSave() {
    setSubmitting(true)
    try {
      await apiClient.put(`/sub-super-admins/${subSuperAdminId}/access`, { orgAccess })
      toast.success(`Access updated for ${subSuperAdminEmail}`)
      onOpenChange(false)
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update access"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Organization access for {subSuperAdminEmail}</DialogTitle>
        </DialogHeader>
        <OrgAccessEditor organizations={organizations} value={orgAccess} onChange={setOrgAccess} />
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : "Save access"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
