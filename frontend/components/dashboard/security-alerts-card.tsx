import Link from "next/link"
import { ShieldAlert, Lock, AlertTriangle } from "lucide-react"
import { SectionHeading } from "./section-heading"

export type SecurityAlerts = {
  lockedAccounts: {
    count: number
    items: {
      userId: string
      name: string
      email: string
      organizationName: string | null
      organizationSlug: string | null
      lockedUntil: string
    }[]
  }
  failedLoginSpikes: {
    organizationId: string
    organizationName: string
    organizationSlug: string
    count: number
    captchaFailures: number
  }[]
}

/** Real security signals only - a locked-out account and a real per-org failed-login count,
 * both computed the same way the app itself enforces lockouts/CAPTCHA. Each row links to that
 * org's own existing Login History page (no cross-org login-history view exists, so this
 * deliberately sends the click to a real, already-built destination rather than a new one). */
export function SecurityAlertsCard({ security }: { security: SecurityAlerts }) {
  const { lockedAccounts, failedLoginSpikes } = security
  const isEmpty = lockedAccounts.items.length === 0 && failedLoginSpikes.length === 0
  const hiddenLockedCount = lockedAccounts.count - lockedAccounts.items.length

  return (
    <section className="flex h-full flex-col gap-3 rounded-xl border bg-card p-5 shadow-soft-sm">
      <SectionHeading icon={ShieldAlert}>Security Alerts</SectionHeading>
      {isEmpty ? (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">No security alerts right now.</p>
        </div>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto">
          {lockedAccounts.items.map((item) => (
            <li key={item.userId} className="flex items-start gap-2.5 text-sm">
              <Lock className="mt-0.5 size-4 shrink-0 text-destructive" />
              {item.organizationSlug ? (
                <Link href={`/${item.organizationSlug}/administration/login-history`} className="hover:underline">
                  <strong>{item.name}</strong> is locked out until {new Date(item.lockedUntil).toLocaleTimeString()}
                  {item.organizationName && <span className="text-muted-foreground"> · {item.organizationName}</span>}
                </Link>
              ) : (
                <span>
                  <strong>{item.name}</strong> is locked out until {new Date(item.lockedUntil).toLocaleTimeString()}
                </span>
              )}
            </li>
          ))}
          {hiddenLockedCount > 0 && (
            <li className="pl-6 text-xs text-muted-foreground">+{hiddenLockedCount} more locked account(s)</li>
          )}
          {failedLoginSpikes.map((spike) => (
            <li key={spike.organizationId} className="flex items-start gap-2.5 text-sm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
              <Link href={`/${spike.organizationSlug}/administration/login-history`} className="hover:underline">
                <strong>{spike.count}</strong> failed logins for {spike.organizationName}
                {spike.captchaFailures > 0 && (
                  <span className="text-muted-foreground"> ({spike.captchaFailures} via CAPTCHA)</span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
