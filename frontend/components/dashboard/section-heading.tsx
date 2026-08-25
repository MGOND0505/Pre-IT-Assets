import * as React from "react"

export function SectionHeading({
  icon: Icon,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="size-4 text-primary" />
      <h2 className="text-sm font-semibold tracking-wide text-foreground">{children}</h2>
      <div className="h-px flex-1 bg-border" />
    </div>
  )
}
