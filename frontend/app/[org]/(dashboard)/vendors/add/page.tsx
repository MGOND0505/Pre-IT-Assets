"use client"

import * as React from "react"
import { useRouter } from "next/navigation"

import { useOrgHref } from "@/lib/use-org-href"

// Add Vendor is now a dialog hosted on the list page (matching every other module's own add/edit
// dialog convention) rather than its own page - this route only exists so the sidebar's
// "Add Vendor" link keeps working unchanged, handing off to /vendors?add=1, which the list page
// reads once on mount to open the dialog.
export default function AddVendorRedirect() {
  const router = useRouter()
  const toOrgHref = useOrgHref()

  React.useEffect(() => {
    router.replace(`${toOrgHref("/vendors")}?add=1`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
