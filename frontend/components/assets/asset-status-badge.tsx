import { Badge } from "@/components/ui/badge"

export const ASSET_STATUSES = [
  "In Stock",
  "Available",
  "Assigned",
  "Reserved",
  "Under Repair",
  "Under Maintenance",
  "Lost",
  "Stolen",
  "Damaged",
  "Retired",
  "Disposed",
] as const

export type AssetStatus = (typeof ASSET_STATUSES)[number]

const VARIANT_BY_STATUS: Record<AssetStatus, "default" | "secondary" | "destructive" | "outline"> = {
  "In Stock": "outline",
  Available: "outline",
  Assigned: "default",
  Reserved: "secondary",
  "Under Repair": "secondary",
  "Under Maintenance": "secondary",
  Lost: "destructive",
  Stolen: "destructive",
  Damaged: "destructive",
  Retired: "secondary",
  Disposed: "secondary",
}

export function AssetStatusBadge({ status }: { status: AssetStatus }) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{status}</Badge>
}
