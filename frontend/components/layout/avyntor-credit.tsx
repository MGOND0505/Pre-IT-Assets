const VARIANT_CLASSES = {
  // Light/neutral backgrounds (login page, custom org backgrounds).
  light: "text-muted-foreground/70 hover:text-muted-foreground",
  // The sidebar, whose background/foreground tokens an org can override via its own color picker.
  sidebar: "text-sidebar-foreground/60 hover:text-sidebar-foreground",
} as const

// Small "Powered by" credit for this app's developer (Avyntor Technologies), distinct from each
// organization's own configurable branding (logo/teamName/colors) elsewhere in the app - this
// never changes per org. Logo + wordmark styling sourced directly from avyntor.com's own site.
export function AvyntorCredit({ variant = "light" }: { variant?: keyof typeof VARIANT_CLASSES }) {
  return (
    <a
      href="https://avyntor.com"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex w-fit items-center gap-1.5 text-xs transition-colors ${VARIANT_CLASSES[variant]}`}
    >
      <img src="/avyntor-logo.png" alt="" className="size-3.5 shrink-0" />
      <span>
        Powered by <span className="font-semibold">Avyntor</span>{" "}
        <span className="font-mono text-[9px] tracking-[0.22em]">TECHNOLOGIES</span>
      </span>
    </a>
  )
}
