import { UserCog } from "lucide-react"
import { SectionHeading } from "./section-heading"

export type UserRoleBreakdown = { role: string; count: number }[]

// Only the 4 real roles this app has - any other value found in the data (e.g. legacy records
// predating the current role model) is intentionally not shown here rather than guessing at a
// bucket for it.
const ROLE_ORDER = ["superAdmin", "subSuperAdmin", "orgAdmin", "teamMember"] as const
const ROLE_LABEL: Record<(typeof ROLE_ORDER)[number], string> = {
  superAdmin: "Super Admins",
  subSuperAdmin: "Sub-Super Admins",
  orgAdmin: "Org Admins",
  teamMember: "Team Members",
}

/** Cross-org role breakdown - not interactive, since there's no single sensible drill-down
 * target for e.g. "how many superAdmins exist". */
export function UserRolesCard({ roles }: { roles: UserRoleBreakdown }) {
  const byRole = new Map(roles.map((r) => [r.role, r.count]))

  return (
    <section className="flex h-full flex-col gap-3 rounded-xl border bg-card p-5 shadow-soft-sm">
      <SectionHeading icon={UserCog}>User Roles</SectionHeading>
      <div className="grid flex-1 grid-cols-2 gap-3">
        {ROLE_ORDER.map((role) => (
          <div key={role} className="flex flex-col justify-center gap-1 rounded-lg bg-muted/40 p-3">
            <span className="text-xs text-muted-foreground">{ROLE_LABEL[role]}</span>
            <span className="text-xl font-semibold tabular-nums">{byRole.get(role) ?? 0}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
