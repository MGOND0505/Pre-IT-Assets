import { Badge } from "@/components/ui/badge"

// "Lease" added alongside the original "Own"/"Rental" per the enterprise ITAM spec.
export const ASSET_OWNERSHIP_TYPES = ["Own", "Rental", "Lease"] as const

export type AssetOwnershipType = (typeof ASSET_OWNERSHIP_TYPES)[number]

const VARIANT_BY_OWNERSHIP: Record<AssetOwnershipType, "default" | "secondary" | "destructive" | "outline"> = {
  Own: "outline",
  Rental: "secondary",
  Lease: "secondary",
}

export function AssetOwnershipBadge({ ownershipType }: { ownershipType: AssetOwnershipType }) {
  return <Badge variant={VARIANT_BY_OWNERSHIP[ownershipType]}>{ownershipType}</Badge>
}
