"use client"

import * as React from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { ModulePermissionGrid } from "@/components/users/permission-grid"
import { emptyPermissions, type PermissionsShape } from "@/lib/permissions"

export type OrgOption = { _id: string; name: string; slug: string }
export type OrgAccessEntry = { organization: string; permissions: PermissionsShape }

/** One checkbox per organization; checking it reveals a full module x action grid (reusing
 * ModulePermissionGrid as-is - it was deliberately built with no isAdmin bypass, since each
 * organization grant here IS the complete, independent permission set for that org). */
export function OrgAccessEditor({
  organizations,
  value,
  onChange,
}: {
  organizations: OrgOption[]
  value: OrgAccessEntry[]
  onChange: (value: OrgAccessEntry[]) => void
}) {
  function isGranted(orgId: string) {
    return value.some((g) => g.organization === orgId)
  }

  function toggleOrg(orgId: string, checked: boolean) {
    if (checked) {
      onChange([...value, { organization: orgId, permissions: emptyPermissions() }])
    } else {
      onChange(value.filter((g) => g.organization !== orgId))
    }
  }

  function updateGrant(orgId: string, permissions: PermissionsShape) {
    onChange(value.map((g) => (g.organization === orgId ? { ...g, permissions } : g)))
  }

  return (
    <div className="flex flex-col gap-4">
      {organizations.map((org) => {
        const granted = isGranted(org._id)
        return (
          <div key={org._id} className="rounded-md border p-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id={`org-access-${org._id}`}
                checked={granted}
                onCheckedChange={(checked) => toggleOrg(org._id, checked === true)}
              />
              <Label htmlFor={`org-access-${org._id}`} className="font-medium">
                {org.name}
              </Label>
            </div>
            {granted && (
              <div className="mt-3">
                <ModulePermissionGrid
                  permissions={value.find((g) => g.organization === org._id)!.permissions}
                  onPermissionsChange={(p) => updateGrant(org._id, p)}
                />
              </div>
            )}
          </div>
        )
      })}
      {organizations.length === 0 && <p className="text-sm text-muted-foreground">No organizations exist yet.</p>}
    </div>
  )
}
