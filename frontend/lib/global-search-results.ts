import { Building2, Users, Boxes, LifeBuoy, type LucideIcon } from "lucide-react"

export type GlobalSearchResultType = "organization" | "user" | "asset" | "ticket"

export type GlobalSearchResult = {
  type: GlobalSearchResultType
  id: string
  title: string
  subtitle: string
  organizationSlug: string | null
  organizationName: string | null
}

export const GLOBAL_RESULT_ICON: Record<GlobalSearchResultType, LucideIcon> = {
  organization: Building2,
  user: Users,
  asset: Boxes,
  ticket: LifeBuoy,
}

export const GLOBAL_RESULT_LABEL: Record<GlobalSearchResultType, string> = {
  organization: "Organization",
  user: "User",
  asset: "Asset",
  ticket: "Ticket",
}

/** Where a cross-org search hit navigates to - organizations go to their own org-scoped detail
 * page, assets/tickets go to their real per-org detail page (Super Admin can browse into any
 * org), users go to their org's Users list (no per-user detail page exists anywhere in the app
 * yet, same rule the org-scoped search already follows for entities without one). */
export function globalResultHref(result: GlobalSearchResult): string {
  const slug = result.organizationSlug ?? ""
  switch (result.type) {
    case "organization":
      return `/${slug}/organization`
    case "asset":
      return `/${slug}/assets/${result.id}`
    case "ticket":
      return `/${slug}/helpdesk/${result.id}`
    case "user":
      return `/${slug}/users`
  }
}
