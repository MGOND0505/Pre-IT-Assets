"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { useRoles } from "@/lib/use-roles"

export function RoleCheckboxList({
  value,
  onChange,
}: {
  value: string[]
  onChange: (roleIds: string[]) => void
}) {
  const { roles, loading } = useRoles()

  function toggle(roleId: string) {
    onChange(value.includes(roleId) ? value.filter((id) => id !== roleId) : [...value, roleId])
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading roles...</p>
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      {roles.map((role) => (
        <div key={role._id} className="flex items-start gap-2">
          <Checkbox
            id={`role-${role._id}`}
            checked={value.includes(role._id)}
            onCheckedChange={() => toggle(role._id)}
          />
          <Label htmlFor={`role-${role._id}`} className="flex flex-col gap-0.5 font-normal">
            <span className="font-medium">{role.name}</span>
            {role.description && <span className="text-xs text-muted-foreground">{role.description}</span>}
          </Label>
        </div>
      ))}
    </div>
  )
}
