import axios, { type AxiosError } from "axios"
import { getOrgSlugFromPathname } from "@/lib/org-slug"

export type ApiEnvelope<T> = {
  success: boolean
  message: string
  data: T
  error: unknown
}

// A production build with no API base URL configured would otherwise silently fall back to
// localhost - the app would then try to reach a dead address from the end user's own browser
// instead of failing loudly at build/boot time. Local dev is unaffected: NODE_ENV is only
// "production" for a real production build/start, never `next dev`.
if (process.env.NODE_ENV === "production" && !process.env.NEXT_PUBLIC_API_BASE_URL) {
  throw new Error("NEXT_PUBLIC_API_BASE_URL must be set in production")
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

// Exact last-path-segment match, not a substring check - "/employee-login" does NOT contain the
// substring "/login" (it's "-login", joined by a hyphen, not a slash), so a naive
// pathname.includes("/login") misses it and would hard-redirect the Employee Portal login page
// back to itself in an infinite loop on every unauthenticated /auth/me check.
const LOGIN_ROUTE_SEGMENTS = new Set(["login", "employee-login"])
function isOnLoginRoute(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean)
  return LOGIN_ROUTE_SEGMENTS.has(segments[segments.length - 1] ?? "")
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiEnvelope<null>>) => {
    if (typeof window !== "undefined") {
      if (error.response?.status === 401) {
        const isAuthRoute = isOnLoginRoute(window.location.pathname)
        if (!isAuthRoute) {
          const orgSlug = getOrgSlugFromPathname(window.location.pathname)
          window.location.href = orgSlug ? `/${orgSlug}/login` : "/login"
        }
      } else if (error.response?.status === 428) {
        // A password change is required (admin-forced reset, or the org's expiry policy) -
        // authenticate.ts blocks everything except this page, /auth/me, and logout.
        const isChangePasswordRoute = window.location.pathname.includes("/profile/change-password")
        if (!isChangePasswordRoute) {
          const orgSlug = getOrgSlugFromPathname(window.location.pathname)
          window.location.href = orgSlug ? `/${orgSlug}/profile/change-password` : "/profile/change-password"
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

/** Same as publicLogoUrl, but for callers with no org in the current URL at all (the Super
 * Admin's own root "/" page previewing a GRANTED organization's logo by row, not the org whose
 * dashboard is currently open) - takes the slug explicitly instead of reading it from
 * window.location.pathname. */
export function publicLogoUrlForSlug(slug: string, extraQuery = ""): string {
  return `${API_ROOT}/${slug}/public/logo${extraQuery}`
}

/** Shape of zod's `.flatten()`, which the backend's validate() middleware attaches as the
 * envelope's `error` field on a 422 - see backend/src/middleware/validate.ts. */
type ZodFlattenedError = { formErrors?: string[]; fieldErrors?: Record<string, string[] | undefined> }

function isZodFlattenedError(value: unknown): value is ZodFlattenedError {
  return typeof value === "object" && value !== null && ("fieldErrors" in value || "formErrors" in value)
}

/** A 422's top-level message is always the generic "Validation failed" - genuinely useless on its
 * own (which field?). Appends the first message per offending field from the zod details the
 * backend already sends, so e.g. "Validation failed" becomes "Validation failed - email: Invalid
 * email". Every other error shape (409 conflicts, 403s, etc.) is unaffected - those already carry
 * a real message. */
export function apiErrorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (axios.isAxiosError(error)) {
    const data = error.response?.data as ApiEnvelope<null> | undefined
    const message = data?.message ?? fallback
    if (isZodFlattenedError(data?.error)) {
      const fieldErrors = data.error.fieldErrors ?? {}
      const details = Object.entries(fieldErrors)
        .filter((entry): entry is [string, string[]] => Boolean(entry[1]?.length))
        .map(([field, messages]) => `${field}: ${messages[0]}`)
      if (details.length > 0) return `${message} - ${details.join("; ")}`
    }
    return message
  }
  return fallback
}
