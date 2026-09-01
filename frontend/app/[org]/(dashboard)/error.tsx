"use client"

import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"

// Catches a crash in any dashboard page/section without blanking the surrounding shell (sidebar/
// topbar) - the parent layout.tsx still renders around this, since it isn't what threw.
export default function DashboardErrorBoundary({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-4 text-center">
      <AlertTriangle className="size-10 text-destructive" />
      <h1 className="text-lg font-semibold">Something went wrong</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        This section couldn&apos;t be displayed. Try again - if it keeps happening, contact your administrator.
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  )
}
