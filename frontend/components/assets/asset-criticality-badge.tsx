import { Badge } from "@/components/ui/badge"

export const ASSET_CRITICALITY_LEVELS = ["Low", "Medium", "High", "Critical"] as const

export type AssetCriticality = (typeof ASSET_CRITICALITY_LEVELS)[number]

const VARIANT_BY_CRITICALITY: Record<AssetCriticality, "default" | "secondary" | "destructive" | "outline"> = {
  Low: "outline",
  Medium: "secondary",
  High: "default",
  Critical: "destructive",
}

export function AssetCriticalityBadge({ criticality }: { criticality: AssetCriticality }) {
  return <Badge variant={VARIANT_BY_CRITICALITY[criticality]}>{criticality}</Badge>
}
