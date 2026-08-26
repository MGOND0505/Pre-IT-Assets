import { Loader2 } from "lucide-react"

/** A real loading state for the brief window between navigating into a page and its auth/role
 * check resolving (e.g. right after login, before the dashboard route can confirm who's viewing
 * it) - previously these guards returned null outright, which reads as a blank/broken page for
 * however long that check takes rather than as "still loading." */
export function FullPageLoader() {
  return (
    <div className="flex h-dvh min-h-0 items-center justify-center bg-muted/30">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
    </div>
  )
}
