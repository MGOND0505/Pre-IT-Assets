"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { useOrgHref } from "@/lib/use-org-href"

// Add Asset is now a dialog hosted on the list page (matching Edit, and every other module's own
// add/edit dialog convention) rather than its own page - this route only exists so the sidebar's
// "Add Asset" link and the category tree's ?category= preset keep working unchanged. It hands off
// to /assets?add=1[&category=...], which the list page reads once on mount to open the dialog.
export default function AddAssetRedirect() {
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const searchParams = useSearchParams()

  React.useEffect(() => {
    const params = new URLSearchParams({ add: "1" })
    const category = searchParams.get("category")
    if (category) params.set("category", category)
    router.replace(`${toOrgHref("/assets")}?${params.toString()}`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
