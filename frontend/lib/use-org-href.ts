"use client"

import { useParams } from "next/navigation"

/** Prefixes a relative dashboard path (e.g. "/assets") with the current org slug (e.g.
 * "/vianaar-delhi/assets"), read from the [org] route segment. Nav config, sidebar links,
 * etc. stay written as plain relative paths - this is the one place that adds the org
 * segment, so there's exactly one thing to get right instead of one per call site. */
export function useOrgHref(): (path: string) => string {
  const params = useParams<{ org?: string }>()
  const orgSlug = params?.org

  return (path: string) => {
    if (!orgSlug) return path
    const suffix = path.startsWith("/") ? path : `/${path}`
    return `/${orgSlug}${suffix === "/" ? "" : suffix}`
  }
}
