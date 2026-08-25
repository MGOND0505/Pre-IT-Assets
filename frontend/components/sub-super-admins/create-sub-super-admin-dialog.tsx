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
import { OrgAccessEditor, type OrgAccessEntry, type OrgOption } from "@/components/sub-super-admins/org-access-editor"
import { apiClient, apiErrorMessage } from "@/lib/api-client"

export function CreateSubSuperAdminDialog({
  organizations,
  onCreated,
}: {
  organizations: OrgOption[]
  onCreated: () => void
}) {
  const [open, setOpen] = React.useState(false)
  const [name, setName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [orgAccess, setOrgAccess] = React.useState<OrgAccessEntry[]>([])
  const [submitting, setSubmitting] = React.useState(false)

  function reset() {
    setName("")
    setEmail("")
    setPassword("")
    setOrgAccess([])
  }

  async function handleSave() {
    if (!name.trim() || !email.trim()) {
      toast.error("Name and email are required")
      return
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters")
      return
    }

    setSubmitting(true)
    try {
      await apiClient.post("/sub-super-admins", { name, email, password, orgAccess })
      toast.success("Sub-Super Admin created")
      reset()
      setOpen(false)
      onCreated()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not create Sub-Super Admin"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button>Create Sub-Super Admin</Button>} />
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Create Sub-Super Admin</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="ssa-name">Name</Label>
            <Input id="ssa-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ssa-email">Email</Label>
            <Input id="ssa-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="ssa-password">Temporary password</Label>
            <Input id="ssa-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>

          <div className="border-t pt-4">
            <p className="mb-3 text-sm font-medium">Organization access</p>
            <OrgAccessEditor organizations={organizations} value={orgAccess} onChange={setOrgAccess} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Creating..." : "Create Sub-Super Admin"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
