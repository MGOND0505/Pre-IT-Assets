import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// Must match backend JWT_COOKIE_NAME (backend/.env). This is a UX-only presence
// check for redirecting logged-out users - the backend is the real auth boundary.
const AUTH_COOKIE_NAME = "itam_token"

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password"]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isPublicPath = PUBLIC_PATHS.some((path) => pathname.startsWith(path))
  const hasSessionCookie = request.cookies.has(AUTH_COOKIE_NAME)

  if (!isPublicPath && !hasSessionCookie) {
    const loginUrl = new URL("/login", request.url)
    loginUrl.searchParams.set("from", pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (isPublicPath && hasSessionCookie) {
    return NextResponse.redirect(new URL("/", request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
