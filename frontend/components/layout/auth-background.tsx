"use client"

import { useBranding } from "@/lib/branding-context"
import { isValidHexColor } from "@/lib/color-utils"
import { cn } from "@/lib/utils"
import { AppLogo } from "@/components/layout/app-logo"
import { AvyntorCredit } from "@/components/layout/avyntor-credit"
import { AiAssistantIcon } from "@/components/ai-assistant/ai-assistant-logo"

export function AuthBackground({
  children,
  className,
  showDeveloperCredit = true,
  showDeveloperCreditIcon = true,
  developerCreditVariant = "prominent",
}: {
  children: React.ReactNode
  className?: string
  showDeveloperCredit?: boolean
  showDeveloperCreditIcon?: boolean
  developerCreditVariant?: "light" | "prominent"
}) {
  const { branding } = useBranding()
  const hasCustomBg = isValidHexColor(branding.appBackgroundColor)
  const style = hasCustomBg ? { backgroundColor: branding.appBackgroundColor } : undefined

  // An org that has set its own background color takes full precedence - preserve the original,
  // simple centered layout rather than fighting a custom color against the brand gradient below.
  if (hasCustomBg) {
    return (
      <div className={cn("flex min-h-dvh flex-col items-center justify-center gap-6 p-4", className)} style={style}>
        {children}
        {showDeveloperCredit && <AvyntorCredit variant={developerCreditVariant} showIcon={showDeveloperCreditIcon} />}
      </div>
    )
  }

  return (
    <div className="relative flex min-h-dvh bg-muted/20">
      <div className="relative hidden w-[42%] shrink-0 flex-col justify-between overflow-hidden bg-gradient-to-br from-primary to-[oklch(0.32_0.19_277)] p-10 text-primary-foreground lg:flex">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 size-80 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -left-16 size-72 rounded-full bg-white/10 blur-3xl"
        />

        <div className="relative inline-flex w-fit items-center rounded-lg bg-white/95 px-3 py-2 shadow-soft-sm">
          <AppLogo imgClassName="h-7 max-w-40 object-contain" textClassName="text-base font-semibold tracking-tight text-foreground" />
        </div>

        <div className="relative flex flex-col gap-3">
          <h2 className="font-display text-3xl leading-tight font-bold text-balance">
            One platform for every organization&apos;s IT assets.
          </h2>
          <p className="text-sm text-primary-foreground/80">
            Assets, licenses, vendors, and access - managed with role-based control across every
            organization you run.
          </p>
          <div className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-primary-foreground/90">
            <AiAssistantIcon className="size-4 shrink-0" />
            AI Assistant included - ask questions in plain language, right inside the app
          </div>
        </div>

        <p className="relative text-xs text-primary-foreground/60">
          &copy; {new Date().getFullYear()} All rights reserved.
        </p>
      </div>

      <div className={cn("relative flex flex-1 flex-col items-center justify-center gap-6 p-4", className)}>
        {children}
        {showDeveloperCredit && <AvyntorCredit variant={developerCreditVariant} showIcon={showDeveloperCreditIcon} />}
      </div>
    </div>
  )
}
