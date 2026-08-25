import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { getOrgSlugFromPathname } from "@/lib/org-slug"

// Must match backend JWT_COOKIE_NAME (backend/.env). This is a UX-only presence
// check for redirecting logged-out users - the backend is the real auth boundary.
const AUTH_COOKIE_NAME = "itam_token"

/** True for both the flat superAdmin login ("/login") and an org-scoped one
 * ("/vianaar-delhi/login"), same for forgot-password/reset-password. A logged-in visitor is
 * bounced AWAY from these specifically (see below) - unlike the bare "/" root. */
function isAuthFormPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean)
  const relevant = getOrgSlugFromPathname(pathname) ? segments.slice(1) : segments
  const leaf = relevant[0]
  return leaf === "login" || leaf === "forgot-password" || leaf === "reset-password"
}

/** Auth forms, plus the bare "/" root - which now also serves the public marketing landing
 * page to a logged-out visitor (app/page.tsx branches on auth state itself once it renders;
 * this middleware just needs to let a logged-out request reach it instead of bouncing to
 * /login). An org-scoped root ("/{orgSlug}") is NOT included here - that's the org's own
 * authenticated dashboard, which must still redirect to that org's login when logged out. */
function isPublicPath(pathname: string): boolean {
  return pathname === "/" || isAuthFormPath(pathname)
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const orgSlug = getOrgSlugFromPathname(pathname)
  const publicPath = isPublicPath(pathname)
  const hasSessionCookie = request.cookies.has(AUTH_COOKIE_NAME)

  if (!publicPath && !hasSessionCookie) {
    const loginPath = orgSlug ? `/${orgSlug}/login` : "/login"
    const loginUrl = new URL(loginPath, request.url)
    // login-form.tsx already defaults to "/" when `from` is absent, so there's nothing to
    // carry for the homepage specifically - just a cleaner URL for the single most common case.
    if (pathname !== "/" && pathname !== `/${orgSlug}`) loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Only bounce an already-logged-in visitor away from an auth FORM (no reason to show them a
  // login screen) - "/" itself stays reachable either way, since app/page.tsx already renders
  // the right thing (Organizations list, org redirect, or the landing page) based on auth state.
  if (isAuthFormPath(pathname) && hasSessionCookie) {
    return NextResponse.redirect(new URL(orgSlug ? `/${orgSlug}` : "/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  // This middleware's cookie-presence redirect is only a UX nicety for actual PAGE
  // navigations - the backend (a separate origin, called directly) has its own real auth check.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
}
