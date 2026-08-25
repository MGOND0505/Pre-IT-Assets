"use client"

import * as React from "react"
import { toast } from "sonner"
import { Boxes, KeyRound, Truck, Building, MapPin, BarChart3, LifeBuoy, ListChecks, X } from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { apiClient, apiErrorMessage } from "@/lib/api-client"
import { ENTITLEMENT_MODULES, MODULE_LABELS, type EntitlementModule } from "@/lib/permissions"

const MODULE_ICON: Record<EntitlementModule, React.ComponentType<{ className?: string }>> = {
  assets: Boxes,
  licenses: KeyRound,
  vendors: Truck,
  departments: Building,
  locations: MapPin,
  reports: BarChart3,
  helpdesk: LifeBuoy,
  tasks: ListChecks,
}

const MODULE_DESCRIPTION: Record<EntitlementModule, string> = {
  assets: "Track and manage IT hardware inventory",
  licenses: "Manage software licenses and renewals",
  vendors: "Manage vendor and supplier records",
  departments: "Organize teams by department",
  locations: "Manage office and site locations",
  reports: "Generate and export reports",
  helpdesk: "Ticketing and support management",
  tasks: "Assign and track team tasks",
}

/** Inline panel (not a modal) for toggling which real, existing entitlement modules an
 * organization has access to - reuses the existing PUT /organizations/:id endpoint
 * (enabledModules is already a field it accepts), so there's no new backend surface here. */
export function ModuleAccessPanel({
  organizationId,
  organizationName,
  enabledModules,
  onClose,
  onSaved,
}: {
  organizationId: string
  organizationName: string
  enabledModules: EntitlementModule[]
  onClose: () => void
  onSaved: () => void
}) {
  const [selected, setSelected] = React.useState<Set<EntitlementModule>>(new Set(enabledModules))
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    setSelected(new Set(enabledModules))
  }, [organizationId, enabledModules])

  function toggle(moduleKey: EntitlementModule) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(moduleKey)) next.delete(moduleKey)
      else next.add(moduleKey)
      return next
    })
  }

  async function handleSave() {
    setSubmitting(true)
    try {
      await apiClient.put(`/organizations/${organizationId}`, { enabledModules: [...selected] })
      toast.success("Module access updated")
      onSaved()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update module access"))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-heading text-base font-semibold">Module Access Control</h2>
            <p className="text-sm text-muted-foreground">Enable or disable modules for {organizationName}.</p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Close" onClick={onClose}>
            <X className="size-4" />
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {ENTITLEMENT_MODULES.map((moduleKey) => {
            const Icon = MODULE_ICON[moduleKey]
            const checked = selected.has(moduleKey)
            return (
              <label
                key={moduleKey}
                className="flex items-start justify-between gap-3 rounded-xl border p-3 transition-colors duration-150 hover:bg-muted/50"
              >
                <div className="flex items-start gap-2.5">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                    <Icon className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-medium">{MODULE_LABELS[moduleKey]}</p>
                    <p className="text-xs text-muted-foreground">{MODULE_DESCRIPTION[moduleKey]}</p>
                  </div>
                </div>
                <Switch checked={checked} onCheckedChange={() => toggle(moduleKey)} />
              </label>
            )
          })}
        </div>

        <div className="flex justify-end gap-2 border-t pt-4">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
