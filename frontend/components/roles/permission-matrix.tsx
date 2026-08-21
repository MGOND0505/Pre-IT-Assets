"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ACTION_ORDER, usePermissionCatalog } from "@/lib/use-permission-catalog"

const ACTION_LABEL: Record<string, string> = {
  read: "Read",
  create: "Create",
  write: "Edit",
  delete: "Delete",
  assign: "Assign",
  transfer: "Transfer",
  retire: "Retire",
  key_reveal: "Key Reveal",
  manage_users: "Manage Users",
}

export function PermissionMatrix({
  value,
  onChange,
  disabled = false,
}: {
  value: string[]
  onChange: (keys: string[]) => void
  disabled?: boolean
}) {
  const { modules, loading } = usePermissionCatalog()

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading permissions...</p>
  }

  function toggle(key: string) {
    if (disabled) return
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key])
  }

  return (
    <div className="overflow-x-auto rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Module</TableHead>
            {ACTION_ORDER.map((action) => (
              <TableHead key={action} className="text-center">
                {ACTION_LABEL[action]}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {modules.map(({ module, permissions }) => (
            <TableRow key={module}>
              <TableCell className="font-medium">{module}</TableCell>
              {ACTION_ORDER.map((action) => {
                const permission = permissions.find((p) => p.action === action)
                return (
                  <TableCell key={action} className="text-center">
                    {permission ? (
                      <Checkbox
                        checked={value.includes(permission.key)}
                        onCheckedChange={() => toggle(permission.key)}
                        disabled={disabled}
                        aria-label={`${module} ${ACTION_LABEL[action]}`}
                      />
                    ) : null}
                  </TableCell>
                )
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
