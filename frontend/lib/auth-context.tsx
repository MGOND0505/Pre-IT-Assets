"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { apiClient, type ApiEnvelope } from "@/lib/api-client"
import { getOrgSlugFromPathname } from "@/lib/org-slug"
import type { EntitlementModule, PermissionsShape } from "@/lib/permissions"
import type { PasswordPolicy } from "@/lib/password-policy"

export type UserRole = "superAdmin" | "subSuperAdmin" | "orgAdmin" | "teamMember"

export type CurrentUser = {
  _id: string
  name: string
  email: string
  role: UserRole
  isAdmin: boolean
  // null for superAdmin AND subSuperAdmin - orgAdmin/teamMember always belong to exactly one
  // organization. For subSuperAdmin, this reflects the org they're CURRENTLY viewing (merged
  // in from /{orgSlug}/my-access below), never their full set of granted organizations.
  organization: { _id: string; name: string; slug: string; enabledModules: EntitlementModule[] } | null
  // For orgAdmin/teamMember/superAdmin: their fixed set. For subSuperAdmin: the CURRENTLY
  // VIEWED org's grant only (see the org-aware refresh logic below) - empty/no-access until
  // that merge has happened.
  permissions: PermissionsShape
  department: { _id: string; name: string } | null
  location: { _id: string; name: string } | null
  status: "Active" | "Inactive"
  mustChangePassword: boolean
  passwordPolicy: PasswordPolicy
}

type AuthContextValue = {
  user: CurrentUser | null
  loading: boolean
  refresh: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

// Matches the backend's SESSION_IDLE_TIMEOUT_MINUTES default (middleware/authenticate.ts) -
// there's no runtime way to read that env var from the browser, so this is a plain constant,
// kept manually in sync the same way permissions.ts already is.
const IDLE_TIMEOUT_MS = 30 * 60 * 1000
const HEARTBEAT_INTERVAL_MS = 60 * 1000
const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const

type MyAccessResponse = {
  organization: { _id: string; name: string; slug: string; enabledModules: EntitlementModule[] } | null
  permissions: PermissionsShape
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<CurrentUser | null>(null)
  const [loading, setLoading] = React.useState(true)
  const pathname = usePathname()
  const orgSlug = React.useMemo(() => getOrgSlugFromPathname(pathname), [pathname])
  // Tracks which org slug the CURRENT user object's permissions were last fetched for, so the
  // org-change effect below only re-fetches when it actually changes - not on every navigation
  // within the same org, and never at all for the other 3 roles.
  const fetchedForSlug = React.useRef<string | null | undefined>(undefined)

  const refresh = React.useCallback(async () => {
    try {
      const res = await apiClient.get<ApiEnvelope<CurrentUser>>("/auth/me")
      let profile = res.data.data

      // A subSuperAdmin's real permissions depend on which org's pages they're on - /auth/me
      // itself stays flat/identity-only (correct for the other 3 roles), so merge in the
      // effective grant for the CURRENT org right away, before ever rendering with it missing.
      // Relative URL, deliberately NOT pre-prefixed here - api-client.ts's interceptor already
      // prefixes it with the current org slug (read from window.location.pathname, the same
      // source `orgSlug` above comes from); prefixing it a second time here would double it up.
      if (profile.role === "subSuperAdmin" && orgSlug) {
        try {
          const accessRes = await apiClient.get<ApiEnvelope<MyAccessResponse>>("/my-access")
          profile = { ...profile, organization: accessRes.data.data.organization, permissions: accessRes.data.data.permissions }
        } catch {
          // No grant for this org (or it's inactive) - leave permissions/organization at their
          // /auth/me defaults; the dashboard layout's wrongOrg guard will bounce this case.
        }
      }

      fetchedForSlug.current = orgSlug
      setUser(profile)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [orgSlug])

  const logout = React.useCallback(async () => {
    // Capture before clearing state - only orgAdmin/teamMember can ever authenticate via an
    // org-scoped login page (their email is only looked up within one fixed organization).
    // superAdmin AND subSuperAdmin always go to the flat login, even a subSuperAdmin whose
    // `organization` field is (for display purposes only) currently set to whichever org
    // they're viewing - that field is never a real "home org" for them, so it must not
    // redirect their post-logout login attempt into an org that would never match their account.
    const canUseOrgLogin = user?.role === "orgAdmin" || user?.role === "teamMember"
    const currentOrgSlug = canUseOrgLogin ? user?.organization?.slug : undefined
    try {
      await apiClient.post("/auth/logout")
    } finally {
      setUser(null)
      window.location.href = currentOrgSlug ? `/${currentOrgSlug}/login` : "/login"
    }
  }, [user])

  React.useEffect(() => {
    refresh()
    // Only on mount - `refresh` itself changes identity every render `orgSlug` changes, but the
    // org-change effect below (subSuperAdmin only) is what handles that, not this one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  React.useEffect(() => {
    if (user?.role !== "subSuperAdmin") return
    if (fetchedForSlug.current === orgSlug) return
    refresh()
  }, [orgSlug, user?.role, refresh])

  // Session idle timeout - proactively logs the user out after IDLE_TIMEOUT_MS of no mouse/
  // keyboard activity, on top of (not instead of) the server's own enforcement in
  // authenticate.ts (which independently rejects any request once its own idle window lapses -
  // this client-side timer just makes it happen the moment the clock runs out, rather than
  // waiting for the user's next click to discover the session is already dead). Only armed while
  // actually logged in - a logged-out visitor sitting on a public page has no session to expire.
  const logoutRef = React.useRef(logout)
  logoutRef.current = logout
  const isLoggedIn = Boolean(user)
  React.useEffect(() => {
    if (!isLoggedIn) return

    let lastActivityAt = Date.now()
    let activitySinceHeartbeat = false
    const markActive = () => {
      lastActivityAt = Date.now()
      activitySinceHeartbeat = true
    }
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, markActive, { passive: true }))

    const interval = window.setInterval(() => {
      if (Date.now() - lastActivityAt >= IDLE_TIMEOUT_MS) {
        logoutRef.current()
        return
      }
      if (activitySinceHeartbeat) {
        activitySinceHeartbeat = false
        // Best-effort - just needs to reach authenticate.ts to slide the server-side session
        // forward; a failure here (e.g. already expired) surfaces naturally on the next real
        // request via the 401 interceptor, nothing more to do about it here.
        apiClient.get("/auth/me").catch(() => {})
      }
    }, HEARTBEAT_INTERVAL_MS)

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActive))
      window.clearInterval(interval)
    }
  }, [isLoggedIn])

  return <AuthContext.Provider value={{ user, loading, refresh, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = React.useContext(AuthContext)
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider")
  return ctx
}
