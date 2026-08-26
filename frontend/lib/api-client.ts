import axios, { type AxiosError } from "axios"
import { getOrgSlugFromPathname } from "@/lib/org-slug"

export type ApiEnvelope<T> = {
  success: boolean
  message: string
  data: T
  error: unknown
}

const API_ROOT = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:5001/api"

export const apiClient = axios.create({
  baseURL: API_ROOT,
  withCredentials: true,
})

// The backend mounts everything except /api/auth/*, /api/health, and /api/organizations under
// /api/:orgSlug/... - prepend the current org slug (read fresh from the URL at the moment of
// each call, not cached React state, so it can never go stale across a client-side navigation
// transition) to every other request. A page with no org in its URL (the flat superAdmin
// /login) simply sends unprefixed requests, which 404 harmlessly for anything that isn't
// /auth/*|/organizations - there's no org-scoped data to show there anyway in this phase.
// /organizations is flat (system-level, spans every org) even though the Organization Details
// page that calls it lives at /{orgSlug}/organization - never prefix it.
apiClient.interceptors.request.use((config) => {
  const url = config.url ?? ""
  const isUnprefixedRoute =
    url === "/auth" ||
    url.startsWith("/auth/") ||
    url === "/organizations" ||
    url.startsWith("/organizations/") ||
    url === "/health" ||
    url.startsWith("/health/")
  if (!isUnprefixedRoute && typeof window !== "undefined") {
    const orgSlug = getOrgSlugFromPathname(window.location.pathname)
    if (orgSlug) {
      config.url = `/${orgSlug}${url.startsWith("/") ? url : `/${url}`}`
    }
  }
  return config
})

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiEnvelope<null>>) => {
    if (typeof window !== "undefined") {
      if (error.response?.status === 401) {
        const isAuthRoute = window.location.pathname.startsWith("/login") || window.location.pathname.includes("/login")
        if (!isAuthRoute) {
          const orgSlug = getOrgSlugFromPathname(window.location.pathname)
          window.location.href = orgSlug ? `/${orgSlug}/login` : "/login"
        }
      }
    }
    return Promise.reject(error)
  }
)

/** Builds a direct (non-axios) URL to an org-scoped API endpoint - for the handful of cases
 * (raw <img src>, an <a href> download link) that hit the backend outside the interceptor above
 * and so need the org slug prefixed manually, the same way the interceptor does it for axios. */
export function orgScopedApiUrl(path: string): string {
  const orgSlug = typeof window !== "undefined" ? getOrgSlugFromPathname(window.location.pathname) : null
  if (!orgSlug) return ""
  return `${API_ROOT}/${orgSlug}${path.startsWith("/") ? path : `/${path}`}`
}

/** The logo is served from the public, unauthenticated /public/logo endpoint (raw <img src>,
 * never through axios/the interceptor above) - build its URL the same org-slug-prefixed way.
 * Returns null (not "") when there's no org in the URL (e.g. the Super Admin panel's own
 * pages) - an <img src=""> re-requests the current document, which is exactly the mistake this
 * return type exists to make impossible for callers to make. */
export function publicLogoUrl(extraQuery = ""): string | null {
  const url = orgScopedApiUrl(`/public/logo${extraQuery}`)
  return url || null
}

export function apiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiEnvelope<null> | undefined
    return data?.message ?? fallback
  }
  return fallback
}
