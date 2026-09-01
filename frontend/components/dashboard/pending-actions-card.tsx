import Link from "next/link"
import { ListChecks } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SectionHeading } from "./section-heading"

export type PendingActions = {
  accessRequests: { count: number }
  expiringOrganizations: { count: number }
  suspendedOrganizations: { count: number }
  unassignedTickets: { count: number }
}

/** Normalizes four real, already-modeled but previously-never-aggregated candidates into one
 * admin to-do list. Each links to the existing page that already surfaces it - unassigned
 * tickets has no link since no cross-org ticket list page exists to send it to (an honest gap,
 * not a fabricated destination). */
export function PendingActionsCard({ pendingActions }: { pendingActions: PendingActions }) {
  const rows = [
    {
      key: "accessRequests",
      count: pendingActions.accessRequests.count,
      label: (n: number) => `${n} pending access request${n === 1 ? "" : "s"}`,
      href: "/sub-super-admins",
    },
    {
      key: "expiringOrganizations",
      count: pendingActions.expiringOrganizations.count,
      label: (n: number) => `${n} organization${n === 1 ? "" : "s"} expiring soon`,
      href: "/",
    },
    {
      key: "suspendedOrganizations",
      count: pendingActions.suspendedOrganizations.count,
      label: (n: number) => `${n} organization${n === 1 ? "" : "s"} suspended`,
      href: "/",
    },
    {
      key: "unassignedTickets",
      count: pendingActions.unassignedTickets.count,
      label: (n: number) => `${n} unassigned open ticket${n === 1 ? "" : "s"}`,
      href: null as string | null,
    },
  ].filter((row) => row.count > 0)

  return (
    <section className="flex h-full flex-col gap-3 rounded-xl border bg-card p-5 shadow-soft-sm">
      <SectionHeading icon={ListChecks}>Pending Actions</SectionHeading>
      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">Nothing pending.</p>
        </div>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
          {rows.map((row) => {
            const body = (
              <span className="flex items-center gap-2">
                <Badge variant="outline" className="tabular-nums">
                  {row.count}
                </Badge>
                {row.label(row.count)}
              </span>
            )
            return (
              <li key={row.key} className="flex items-center gap-2.5 text-sm">
                {row.href ? (
                  <Link href={row.href} className="hover:underline">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
