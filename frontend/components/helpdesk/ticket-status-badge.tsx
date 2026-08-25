import { Badge } from "@/components/ui/badge"

export const TICKET_STATUSES = ["New", "Open", "In Progress", "Pending", "Resolved", "Closed", "Reopened"] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

const VARIANT: Record<TicketStatus, "default" | "secondary" | "outline" | "success" | "warning" | "destructive"> = {
  New: "secondary",
  Open: "default",
  "In Progress": "warning",
  Pending: "warning",
  Resolved: "success",
  Closed: "outline",
  Reopened: "destructive",
}

export function TicketStatusBadge({ status }: { status: TicketStatus }) {
  return <Badge variant={VARIANT[status] ?? "outline"}>{status}</Badge>
}
