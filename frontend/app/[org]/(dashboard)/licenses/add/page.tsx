"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { useOrgHref } from "@/lib/use-org-href"

// Add License is now a dialog hosted on the list page (matching Edit, and every other module's
// own add/edit dialog convention) rather than its own page - this route only exists so the
// sidebar's "Add License" link keeps working unchanged, handing off to /licenses?add=1, which the
// list page reads once on mount to open the dialog.
export default function AddLicenseRedirect() {
  const router = useRouter()
  const toOrgHref = useOrgHref()

  React.useEffect(() => {
    router.replace(`${toOrgHref("/licenses")}?add=1`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
