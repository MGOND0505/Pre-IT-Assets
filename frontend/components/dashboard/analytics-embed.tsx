"use client"

import * as React from "react"
import { AlertTriangle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"

// Metabase's signed embed tokens are short-lived (10 minutes, set server-side) - refreshed a
// couple of minutes early so a viewer who leaves the dashboard open doesn't ever see Metabase's
// own "embedding token expired" error inside the iframe.
const REFRESH_INTERVAL_MS = 8 * 60 * 1000

/**
 * A real Metabase dashboard (Assets + Licenses analytics), embedded via a signed JWT the
 * backend mints per-request - Metabase itself enforces the locked Organization filter baked
 * into that token, so this can only ever show the current organization's own data. Not a
 * placeholder: this is the actual "IT Asset Management Dashboard" built in metabase/provision.mjs.
 */
export function AnalyticsEmbed() {
  const [url, setUrl] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  const fetchUrl = React.useCallback(async () => {
    try {
      const res = await apiClient.get<ApiEnvelope<{ url: string }>>("/analytics/embed-url")
      setUrl(res.data.data.url)
      setError(null)
    } catch (err) {
      setError(apiErrorMessage(err, "Could not load analytics"))
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchUrl()
    const interval = setInterval(fetchUrl, REFRESH_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [fetchUrl])

  if (loading) {
    return <Skeleton className="h-[600px] w-full rounded-xl" />
  }

  if (error || !url) {
    return (
      <div className="flex h-40 flex-col items-center justify-center gap-2 rounded-xl border bg-card text-center text-sm text-muted-foreground">
        <AlertTriangle className="size-5 text-muted-foreground" />
        {error ?? "Analytics dashboard is not available right now."}
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-soft-sm">
      <iframe
        key={url}
        src={url}
        title="Analytics"
        className="h-[600px] w-full border-0"
        loading="lazy"
      />
    </div>
  )
}
