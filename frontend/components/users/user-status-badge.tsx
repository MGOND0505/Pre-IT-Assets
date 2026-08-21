import { Badge } from "@/components/ui/badge"

export function UserStatusBadge({ status }: { status: "Active" | "Inactive" }) {
  return (
    <Badge variant={status === "Active" ? "default" : "secondary"}>{status}</Badge>
  )
}
