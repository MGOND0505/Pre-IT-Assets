import Link from "next/link"
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { SectionHeading } from "./section-heading"

export type TicketInsights = {
  days: number
  ticketVolumeChangePct: number | null
  ticketsInPeriod: number
  ticketsInPriorPeriod: number
  topCategoryInPeriod: string | null
}

export type TicketAlert = {
  id: string
  ticketId: string
  subject: string
  slaResolutionDueAt: string
  /** Only present on the cross-organization Super Admin dashboard - the org-scoped dashboard's
   * own alerts never send this, since the org is already implicit there. */
  organizationName?: string | null
  organizationSlug?: string | null
}

function periodLabel(days: number): string {
  return days === 7 ? "week" : `${days} days`
}

/**
 * Real, computed observations only - no invented "AI" narrative. Both numbers come directly
 * from createdDate range counts (this period vs the one before it), never a fabricated trend.
 * The AI accent styling is reused from the app's existing "AI-native" visual language, applied
 * here because this genuinely is a computed observation, not because it's dressed up to look
 * like one. Shared between the Super Admin (cross-org) and org-scoped dashboards - identical
 * shape, just a different data source (and date-range filter) behind it.
 */
export function TicketInsightsCard({ insights }: { insights: TicketInsights }) {
  const period = periodLabel(insights.days)
  return (
    <section className="ai-border-glow flex h-full flex-col gap-3 rounded-xl bg-card p-5 shadow-soft-sm">
      <div className="flex items-center gap-2">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundImage: "linear-gradient(135deg, var(--ai-from), var(--ai-to))" }}
        >
          <Sparkles className="size-3.5" />
        </span>
        <h2 className="text-sm font-semibold tracking-wide">AI Insights</h2>
        <Badge variant="outline" className="text-[10px]">
          Beta
        </Badge>
      </div>
      <p className="flex flex-1 items-center gap-2 text-sm">
        {insights.ticketVolumeChangePct !== null ? (
          insights.ticketVolumeChangePct >= 0 ? (
            <TrendingUp className="mt-0.5 size-4 shrink-0 text-warning" />
          ) : (
            <TrendingDown className="mt-0.5 size-4 shrink-0 text-success" />
          )
        ) : (
          <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        )}
        <span>
          {insights.ticketVolumeChangePct !== null ? (
            <>
              Ticket volume {insights.ticketVolumeChangePct >= 0 ? "increased" : "decreased"} by{" "}
              <strong>{Math.abs(insights.ticketVolumeChangePct)}%</strong> compared to the previous {period}
              {insights.topCategoryInPeriod && (
                <>
                  {" "}
                  - most active category: <strong>{insights.topCategoryInPeriod}</strong>
                </>
              )}
              .
            </>
          ) : (
            <>
              {insights.ticketsInPeriod} ticket(s) created in the last {period} (none in the previous {period} to
              compare against).
            </>
          )}
        </span>
      </p>
    </section>
  )
}

export function TicketAlertsCard({
  alerts,
  hrefForAlert,
}: {
  alerts: TicketAlert[]
  /** When provided, each alert becomes a link (e.g. straight to the breached ticket) - omitted
   * entirely when there's nowhere sensible to send the click. */
  hrefForAlert?: (alert: TicketAlert) => string
}) {
  return (
    <section className="flex h-full flex-col gap-3 rounded-xl border bg-card p-5 shadow-soft-sm">
      <SectionHeading icon={AlertTriangle}>System Alerts</SectionHeading>
      {alerts.length === 0 ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No SLA breaches right now.</p>
        </div>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
          {alerts.map((alert) => {
            const body = (
              <span>
                <strong>#{alert.ticketId}</strong> {alert.subject} is past its SLA deadline
                {alert.organizationName && <span className="text-muted-foreground"> · {alert.organizationName}</span>}
              </span>
            )
            const href = hrefForAlert?.(alert)
            return (
              <li key={alert.id} className="flex items-start gap-2.5 text-sm">
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-destructive" />
                {href ? (
                  <Link href={href} className="hover:underline">
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
