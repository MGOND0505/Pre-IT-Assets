import { Boxes, KeyRound, Truck, Building, MapPin, LifeBuoy, ListChecks, Users, type LucideIcon } from "lucide-react"

export type SearchResultType = "asset" | "license" | "ticket" | "task" | "vendor" | "department" | "location" | "user"
export type SearchResult = { type: SearchResultType; id: string; title: string; subtitle: string }

/** Where each data result type navigates to - asset/license/ticket have their own detail page,
 * so a hit there goes straight to the record; the rest have no detail page yet, so a hit goes to
 * the module's list page rather than faking a deep link that doesn't exist. */
export const SEARCH_RESULT_HREF: Record<SearchResultType, (id: string) => string> = {
  asset: (id) => `/assets/${id}`,
  license: (id) => `/licenses/${id}`,
  ticket: (id) => `/helpdesk/${id}`,
  task: () => "/tasks",
  vendor: () => "/vendors",
  department: () => "/departments",
  location: () => "/locations",
  user: () => "/users",
}

export const SEARCH_RESULT_ICON: Record<SearchResultType, LucideIcon> = {
  asset: Boxes,
  license: KeyRound,
  ticket: LifeBuoy,
  task: ListChecks,
  vendor: Truck,
  department: Building,
  location: MapPin,
  user: Users,
}

export const SEARCH_RESULT_LABEL: Record<SearchResultType, string> = {
  asset: "Asset",
  license: "License",
  ticket: "Ticket",
  task: "Task",
  vendor: "Vendor",
  department: "Department",
  location: "Location",
  user: "User",
}
