"use client"

import * as React from "react"

import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  MODULE_ACTIONS,
  MODULE_LABELS,
  PERMISSION_MODULES,
  emptyPermissions,
  type PermissionAction,
  type PermissionModule,
  type PermissionsShape,
} from "@/lib/permissions"
import { cn } from "@/lib/utils"

export { emptyPermissions }

const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "View",
  create: "Create",
  update: "Update",
  delete: "Delete",
  import: "Import",
  export: "Export",
  assign: "Assign",
  reassign: "Reassign",
  close: "Close",
  reopen: "Reopen",
  comment: "Comment",
  internalNote: "Internal Note",
  manageAttachments: "Attachments",
  editAssetId: "Edit Asset ID",
}

/** The actions common to nearly every module - shown as full matrix columns. Anything a module
 * needs beyond these (Helpdesk's workflow actions, Tasks' Assign, Assets' Edit Asset ID) is
 * used by only one or two modules out of twelve, so giving each its own matrix column left the
 * table 14 columns wide with dead "-" cells everywhere else. Those go in a compact
 * "Additional permissions" section below the table instead, keyed off MODULE_ACTIONS so it
 * never needs to know which modules those are - it just reacts to whatever isn't core. */
const CORE_ACTIONS: readonly PermissionAction[] = ["view", "create", "update", "delete", "import", "export"]

type HelpdeskRoleKey = "requester" | "l1Support" | "l2Support" | "l3Support" | "helpdeskManager" | "helpdeskAdmin"

/** Named-role presets scoped to just the helpdesk module's row, per the spec's "configurable
 * roles" (Helpdesk Admin/Manager/L1-L3 Support/Requester) - convenience buttons over the same
 * granular PermissionsShape, not a second role/permission data model. L1/L2/L3 map to the same
 * action set today (the tier concept itself lives in SupportTeam membership, not here) but keep
 * distinct labels since a manager picking "L2 Support" is a meaningful, self-documenting choice. */
const HELPDESK_ROLE_ACTIONS: Record<HelpdeskRoleKey, PermissionAction[]> = {
  requester: ["view", "create", "comment"],
  l1Support: ["view", "update", "comment", "internalNote", "manageAttachments", "close", "reopen"],
  l2Support: ["view", "update", "comment", "internalNote", "manageAttachments", "close", "reopen"],
  l3Support: ["view", "update", "comment", "internalNote", "manageAttachments", "close", "reopen"],
  helpdeskManager: [
    "view",
    "create",
    "update",
    "assign",
    "reassign",
    "close",
    "reopen",
    "comment",
    "internalNote",
    "manageAttachments",
    "export",
  ],
  helpdeskAdmin: [
    "view",
    "create",
    "update",
    "delete",
    "assign",
    "reassign",
    "close",
    "reopen",
    "comment",
    "internalNote",
    "manageAttachments",
    "export",
  ],
}

const HELPDESK_ROLE_LABELS: Record<HelpdeskRoleKey, string> = {
  requester: "Requester",
  l1Support: "L1 Support",
  l2Support: "L2 Support",
  l3Support: "L3 Support",
  helpdeskManager: "Helpdesk Manager",
  helpdeskAdmin: "Helpdesk Admin",
}

type PresetKey =
  | "noAccess"
  | "readOnly"
  | "create"
  | "readCreate"
  | "readUpdate"
  | "readCreateUpdate"
  | "fullAccess"
  | "custom"

const PRESET_ACTIONS: Record<Exclude<PresetKey, "custom">, PermissionAction[]> = {
  noAccess: [],
  readOnly: ["view"],
  create: ["create"],
  readCreate: ["view", "create"],
  readUpdate: ["view", "update"],
  readCreateUpdate: ["view", "create", "update"],
  fullAccess: ["view", "create", "update", "delete", "import", "export"],
}

const PRESET_LABELS: Record<PresetKey, string> = {
  noAccess: "No Access",
  readOnly: "Read Only",
  create: "Create",
  readCreate: "Read + Create",
  readUpdate: "Read + Update",
  readCreateUpdate: "Read + Create + Update",
  fullAccess: "Full Access",
  custom: "Custom",
}

const PRESET_ORDER: PresetKey[] = [
  "noAccess",
  "readOnly",
  "create",
  "readCreate",
  "readUpdate",
  "readCreateUpdate",
  "fullAccess",
  "custom",
]

function applyPreset(preset: Exclude<PresetKey, "custom">): PermissionsShape {
  const next = emptyPermissions()
  const wanted = new Set(PRESET_ACTIONS[preset])
  for (const moduleKey of PERMISSION_MODULES) {
    for (const action of MODULE_ACTIONS[moduleKey]) {
      next[moduleKey][action] = wanted.has(action)
    }
  }
  return next
}

/** Which preset (if any) the current matrix exactly matches - only over the actions that
 * actually apply to each module, so an irrelevant always-false cell never breaks a match. */
function detectPreset(permissions: PermissionsShape): PresetKey {
  for (const preset of PRESET_ORDER) {
    if (preset === "custom") continue
    const wanted = new Set(PRESET_ACTIONS[preset])
    const matches = PERMISSION_MODULES.every((moduleKey) =>
      MODULE_ACTIONS[moduleKey].every((action) => permissions[moduleKey][action] === wanted.has(action))
    )
    if (matches) return preset
  }
  return "custom"
}

/** The preset dropdown + module x action matrix, with no notion of an "isAdmin" bypass -
 * reused as-is by the Sub Super Admin per-org grant editor, which has no such bypass (each
 * organization grant IS the full, independent permission set for that org). */
export function ModulePermissionGrid({
  permissions,
  onPermissionsChange,
}: {
  permissions: PermissionsShape
  onPermissionsChange: (value: PermissionsShape) => void
}) {
  const currentPreset = detectPreset(permissions)

  function setCell(moduleKey: PermissionModule, action: PermissionAction, value: boolean) {
    onPermissionsChange({
      ...permissions,
      [moduleKey]: { ...permissions[moduleKey], [action]: value },
    })
  }

  function applyHelpdeskRole(role: HelpdeskRoleKey) {
    const wanted = new Set(HELPDESK_ROLE_ACTIONS[role])
    const nextHelpdesk = { ...permissions.helpdesk }
    for (const action of MODULE_ACTIONS.helpdesk) {
      nextHelpdesk[action] = wanted.has(action)
    }
    onPermissionsChange({ ...permissions, helpdesk: nextHelpdesk })
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pb-1">
        <div className="flex items-center gap-2">
          <Label htmlFor="perm-preset" className="text-sm text-muted-foreground">
            Access type
          </Label>
          <Select
            value={currentPreset}
            onValueChange={(v) => {
              if (v && v !== "custom") onPermissionsChange(applyPreset(v as Exclude<PresetKey, "custom">))
            }}
          >
            <SelectTrigger id="perm-preset" className="w-48 sm:w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRESET_ORDER.map((preset) => (
                <SelectItem key={preset} value={preset} disabled={preset === "custom"}>
                  {PRESET_LABELS[preset]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label htmlFor="perm-helpdesk-role" className="text-sm text-muted-foreground">
            Helpdesk role
          </Label>
          <Select value="" onValueChange={(v) => v && applyHelpdeskRole(v as HelpdeskRoleKey)}>
            <SelectTrigger id="perm-helpdesk-role" className="w-40 sm:w-48">
              <SelectValue placeholder="Quick-apply..." />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(HELPDESK_ROLE_LABELS) as HelpdeskRoleKey[]).map((role) => (
                <SelectItem key={role} value={role}>
                  {HELPDESK_ROLE_LABELS[role]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="p-2 text-left font-medium">Module</th>
              {CORE_ACTIONS.map((action) => (
                <th key={action} className="p-2 text-center font-medium">
                  {ACTION_LABELS[action]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MODULES.map((moduleKey) => (
              <tr key={moduleKey} className="border-b transition-colors last:border-b-0 hover:bg-muted/40">
                <td className="p-2 font-medium">{MODULE_LABELS[moduleKey]}</td>
                {CORE_ACTIONS.map((action) => {
                  if (!MODULE_ACTIONS[moduleKey].includes(action)) {
                    return (
                      <td key={action} className="p-2 text-center text-muted-foreground/50">
                        &ndash;
                      </td>
                    )
                  }
                  return (
                    <td key={action} className="p-2 text-center">
                      <Checkbox
                        checked={permissions[moduleKey][action]}
                        onCheckedChange={(checked) => setCell(moduleKey, action, checked === true)}
                      />
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {PERMISSION_MODULES.some((m) => MODULE_ACTIONS[m].some((a) => !CORE_ACTIONS.includes(a))) && (
        <div className="flex flex-col gap-2.5 rounded-md border p-3">
          <p className="text-sm font-medium text-muted-foreground">Additional permissions</p>
          <div className="flex flex-col divide-y">
            {PERMISSION_MODULES.map((moduleKey) => {
              const extra = MODULE_ACTIONS[moduleKey].filter((a) => !CORE_ACTIONS.includes(a))
              if (extra.length === 0) return null
              return (
                <div key={moduleKey} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2 first:pt-0 last:pb-0">
                  <span className="w-28 shrink-0 text-sm font-medium">{MODULE_LABELS[moduleKey]}</span>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    {extra.map((action) => (
                      <label
                        key={action}
                        className="flex cursor-pointer items-center gap-1.5 text-sm text-muted-foreground"
                      >
                        <Checkbox
                          checked={permissions[moduleKey][action]}
                          onCheckedChange={(checked) => setCell(moduleKey, action, checked === true)}
                        />
                        {ACTION_LABELS[action]}
                      </label>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

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
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <label
        htmlFor="perm-is-admin"
        className={cn(
          "flex cursor-pointer items-center gap-2 rounded-md border p-3 transition-colors",
          isAdmin && "border-primary/30 bg-primary/5"
        )}
      >
        <Checkbox
          id="perm-is-admin"
          checked={isAdmin}
          onCheckedChange={(checked) => onIsAdminChange(checked === true)}
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Admin</span>
          <span className="text-xs text-muted-foreground">Full access to every module and action</span>
        </span>
      </label>

      <div className={isAdmin ? "pointer-events-none opacity-50" : undefined}>
        <ModulePermissionGrid
          permissions={isAdmin ? applyPreset("fullAccess") : permissions}
          onPermissionsChange={onPermissionsChange}
        />
      </div>
    </div>
  )
}
