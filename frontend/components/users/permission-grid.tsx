"use client"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { emptyPermissions, type PermissionsShape } from "@/lib/permissions"

const AREA_ROWS: { key: "assets" | "licenses"; label: string }[] = [
  { key: "assets", label: "Assets" },
  { key: "licenses", label: "Licenses" },
]

export { emptyPermissions }

export function PermissionGrid({
  isAdmin,
  onIsAdminChange,
  permissions,
  onPermissionsChange,
}: {
  isAdmin: boolean
  onIsAdminChange: (value: boolean) => void
  permissions: PermissionsShape
  onPermissionsChange: (value: PermissionsShape) => void
}) {
  function setArea(area: "assets" | "licenses", action: "read" | "add" | "edit" | "delete", value: boolean) {
    onPermissionsChange({
      ...permissions,
      [area]: { ...permissions[area], [action]: value },
    })
  }

  function setReportsRead(value: boolean) {
    onPermissionsChange({ ...permissions, reports: { read: value } })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Checkbox
          id="perm-is-admin"
          checked={isAdmin}
          onCheckedChange={(checked) => onIsAdminChange(checked === true)}
        />
        <Label htmlFor="perm-is-admin" className="font-medium">
          Admin (full access to everything)
        </Label>
      </div>

      <div className={isAdmin ? "pointer-events-none opacity-50" : undefined}>
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="p-2 text-left font-medium">Area</th>
                <th className="p-2 text-center font-medium">Read</th>
                <th className="p-2 text-center font-medium">Add</th>
                <th className="p-2 text-center font-medium">Edit</th>
                <th className="p-2 text-center font-medium">Delete</th>
              </tr>
            </thead>
            <tbody>
              {AREA_ROWS.map((row) => (
                <tr key={row.key} className="border-b last:border-b-0">
                  <td className="p-2">{row.label}</td>
                  {(["read", "add", "edit", "delete"] as const).map((action) => (
                    <td key={action} className="p-2 text-center">
                      <Checkbox
                        checked={isAdmin || permissions[row.key][action]}
                        onCheckedChange={(checked) => setArea(row.key, action, checked === true)}
                      />
                    </td>
                  ))}
                </tr>
              ))}
              <tr>
                <td className="p-2">Reports</td>
                <td className="p-2 text-center">
                  <Checkbox
                    checked={isAdmin || permissions.reports.read}
                    onCheckedChange={(checked) => setReportsRead(checked === true)}
                  />
                </td>
                <td className="p-2 text-center text-muted-foreground">-</td>
                <td className="p-2 text-center text-muted-foreground">-</td>
                <td className="p-2 text-center text-muted-foreground">-</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
