import { Badge } from "@/components/ui/badge"

export const ASSET_OWNERSHIP_TYPES = ["Own", "Rental"] as const

export type AssetOwnershipType = (typeof ASSET_OWNERSHIP_TYPES)[number]

const VARIANT_BY_OWNERSHIP: Record<AssetOwnershipType, "default" | "secondary" | "destructive" | "outline"> = {
  Own: "outline",
  Rental: "secondary",
}

export function AssetOwnershipBadge({ ownershipType }: { ownershipType: AssetOwnershipType }) {
  return <Badge variant={VARIANT_BY_OWNERSHIP[ownershipType]}>{ownershipType}</Badge>
}
