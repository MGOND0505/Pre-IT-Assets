import { Badge } from "@/components/ui/badge"

export const LICENSE_STATUSES = ["Active", "Expired", "Cancelled"] as const
export type LicenseStatusValue = (typeof LICENSE_STATUSES)[number]

const VARIANT_BY_STATUS: Record<LicenseStatusValue, "default" | "secondary" | "destructive" | "outline"> = {
  Active: "default",
  Expired: "destructive",
  Cancelled: "secondary",
}

export function LicenseStatusBadge({ status }: { status: LicenseStatusValue }) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{status}</Badge>
}

export type ExpiryUrgency = "expired" | "critical" | "warning" | "ok" | "none"

export function daysRemaining(expiryDate: string | null): number | null {
  if (!expiryDate) return null
  const diffMs = new Date(expiryDate).setHours(0, 0, 0, 0) - new Date().setHours(0, 0, 0, 0)
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

export function expiryUrgency(days: number | null): ExpiryUrgency {
  if (days === null) return "none"
  if (days < 0) return "expired"
  if (days <= 15) return "critical"
  if (days <= 30) return "warning"
  return "ok"
}

const EXPIRY_LABEL: Record<ExpiryUrgency, string> = {
  expired: "🔴 Expired",
  critical: "🔴 Expiring soon",
  warning: "🟡 Expiring soon",
  ok: "🟢 Active",
  none: "-",
}

const EXPIRY_VARIANT: Record<ExpiryUrgency, "default" | "secondary" | "destructive" | "outline"> = {
  expired: "destructive",
  critical: "destructive",
  warning: "secondary",
  ok: "outline",
  none: "outline",
}

export function LicenseExpiryBadge({ expiryDate }: { expiryDate: string | null }) {
  const days = daysRemaining(expiryDate)
  const urgency = expiryUrgency(days)

  return (
    <div className="flex flex-col gap-0.5">
      <Badge variant={EXPIRY_VARIANT[urgency]}>{EXPIRY_LABEL[urgency]}</Badge>
      {days !== null && (
        <span className="text-xs text-muted-foreground">
          {days < 0 ? `${Math.abs(days)} days ago` : `${days} days left`}
        </span>
      )}
    </div>
  )
}
