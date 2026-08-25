"use client"

import * as React from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import {
  useDepartmentOptions,
  useHelpdeskCategoryOptions,
  useLocationOptions,
  useUserOptions,
} from "@/lib/use-lookup-options"

export type SupportTeamMember = { user: { _id: string; name: string; email: string } | string; isActive: boolean }

export type SupportTeam = {
  _id: string
  name: string
  tier: "L1" | "L2" | "L3"
  categories: { _id: string; name: string }[]
  departments: { _id: string; name: string }[]
  locations: { _id: string; name: string }[]
  members: SupportTeamMember[]
  status: "Active" | "Inactive"
}

function idOf(ref: { _id: string } | string): string {
  return typeof ref === "string" ? ref : ref._id
}

function CheckboxList({
  options,
  selected,
  onToggle,
  emptyLabel,
}: {
  options: { _id: string; name: string }[]
  selected: string[]
  onToggle: (id: string) => void
  emptyLabel: string
}) {
  if (options.length === 0) return <p className="text-xs text-muted-foreground">{emptyLabel}</p>
  return (
    <div className="grid max-h-32 grid-cols-2 gap-1 overflow-y-auto rounded-md border p-2">
      {options.map((opt) => (
        <label key={opt._id} className="flex items-center gap-2 text-sm">
          <Checkbox checked={selected.includes(opt._id)} onCheckedChange={() => onToggle(opt._id)} />
          {opt.name}
        </label>
      ))}
    </div>
  )
}

export function SupportTeamFormDialog({
  team,
  onSaved,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  team?: SupportTeam
  onSaved: () => void
  trigger?: React.ReactElement
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isEdit = Boolean(team)
  const isControlled = controlledOpen !== undefined
  const [internalOpen, setInternalOpen] = React.useState(false)
  const open = isControlled ? controlledOpen : internalOpen
  const setOpen = isControlled ? onOpenChange! : setInternalOpen

  const { items: categories } = useHelpdeskCategoryOptions()
  const { items: departments } = useDepartmentOptions()
  const { items: locations } = useLocationOptions()
  const { items: users } = useUserOptions()

  const [name, setName] = React.useState("")
  const [tier, setTier] = React.useState<"L1" | "L2" | "L3">("L1")
  const [categoryIds, setCategoryIds] = React.useState<string[]>([])
  const [departmentIds, setDepartmentIds] = React.useState<string[]>([])
  const [locationIds, setLocationIds] = React.useState<string[]>([])
  const [memberIds, setMemberIds] = React.useState<string[]>([])
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setName(team?.name ?? "")
    setTier(team?.tier ?? "L1")
    setCategoryIds(team?.categories.map((c) => c._id) ?? [])
    setDepartmentIds(team?.departments.map((d) => d._id) ?? [])
    setLocationIds(team?.locations.map((l) => l._id) ?? [])
    setMemberIds(team?.members.map((m) => idOf(m.user)) ?? [])
  }, [open, team])

  function toggle(list: string[], setList: (v: string[]) => void, id: string) {
    setList(list.includes(id) ? list.filter((v) => v !== id) : [...list, id])
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error("Name is required")
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        name,
        tier,
        categories: categoryIds,
        departments: departmentIds,
        locations: locationIds,
        members: memberIds.map((user) => ({ user, isActive: true })),
      }
      if (isEdit && team) {
        await apiClient.put(`/support-teams/${team._id}`, payload)
        toast.success("Support team updated")
      } else {
        await apiClient.post("/support-teams", payload)
        toast.success("Support team created")
      }
      setOpen(false)
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not save support team"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {!isControlled && <DialogTrigger render={trigger ?? <Button>Add support team</Button>} />}
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit support team" : "Add support team"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="team-name">Name</Label>
            <Input id="team-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. L1 Helpdesk" />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="team-tier">Support tier</Label>
            <Select value={tier} onValueChange={(v) => v && setTier(v as "L1" | "L2" | "L3")}>
              <SelectTrigger id="team-tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="L1">L1</SelectItem>
                <SelectItem value="L2">L2</SelectItem>
                <SelectItem value="L3">L3</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Categories (leave empty to match any)</Label>
            <CheckboxList
              options={categories}
              selected={categoryIds}
              onToggle={(id) => toggle(categoryIds, setCategoryIds, id)}
              emptyLabel="No categories configured yet."
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Departments (leave empty to match any)</Label>
            <CheckboxList
              options={departments}
              selected={departmentIds}
              onToggle={(id) => toggle(departmentIds, setDepartmentIds, id)}
              emptyLabel="No departments configured yet."
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label>Locations (leave empty to match any)</Label>
            <CheckboxList
              options={locations}
              selected={locationIds}
              onToggle={(id) => toggle(locationIds, setLocationIds, id)}
              emptyLabel="No locations configured yet."
            />
          </div>

          <div className="flex flex-col gap-2 border-t pt-4">
            <Label>Agents (round-robin order follows selection order)</Label>
            <CheckboxList
              options={users}
              selected={memberIds}
              onToggle={(id) => toggle(memberIds, setMemberIds, id)}
              emptyLabel="No users found."
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : isEdit ? "Save changes" : "Create team"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
