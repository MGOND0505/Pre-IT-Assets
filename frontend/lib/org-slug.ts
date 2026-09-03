/** Mirrors the backend's RESERVED_SLUGS (backend/src/modules/organizations/organizations.service.ts) -
 * path segments that are never an organization's slug, so a URL like /login or /api/... is
 * never mistaken for "the organization is called login". */
const RESERVED_SLUGS = new Set([
  "login",
  "logout",
  "forgot-password",
  "reset-password",
  "audit-logs",
  "dashboard",
  "security-settings",
  "system-monitoring",
  "users",
  "api",
  "system",
  "admin",
  "superadmin",
  "super-admin",
  "organizations",
  "sub-super-admins",
  "my-organizations",
  "_next",
  "static",
  "favicon.ico",
]);

/** Extracts the org slug from a pathname if the first segment looks like one, e.g.
 * "/vianaar-delhi/assets" -> "vianaar-delhi", but "/login" -> null (reserved) and "/" -> null. */
export function getOrgSlugFromPathname(pathname: string): string | null {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  if (!firstSegment || RESERVED_SLUGS.has(firstSegment)) return null;
  return firstSegment;
}
