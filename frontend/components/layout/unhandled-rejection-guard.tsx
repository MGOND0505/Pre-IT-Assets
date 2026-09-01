"use client"

import * as React from "react"
import { toast } from "sonner"
import axios from "axios"
import { apiErrorMessage } from "@/lib/api-client"

/** A safety net for any apiClient call somewhere in the app that isn't wrapped in its own try/
 * catch - without this, a rejected request (e.g. a 429 from the rate limiter, or any other
 * non-2xx response) becomes a truly unhandled promise rejection, which in dev shows Next.js's
 * full-screen error overlay instead of a toast, and in production just fails silently. Properly
 * try/catch-wrapped calls elsewhere never reach this at all - it only ever sees the ones nothing
 * else caught, so it can't double up with a component's own toast. */
export function UnhandledRejectionGuard() {
  React.useEffect(() => {
    function handleRejection(event: PromiseRejectionEvent) {
      const reason = event.reason
      if (axios.isAxiosError(reason)) {
        event.preventDefault()
        if (reason.response?.status === 429) {
          toast.error("Too many requests - please slow down and try again in a moment.")
        } else {
          toast.error(apiErrorMessage(reason, "Something went wrong"))
        }
      }
    }
    window.addEventListener("unhandledrejection", handleRejection)
    return () => window.removeEventListener("unhandledrejection", handleRejection)
  }, [])

  return null
}
