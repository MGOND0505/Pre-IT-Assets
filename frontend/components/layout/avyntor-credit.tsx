const VARIANT_CLASSES = {
  // Light/neutral backgrounds (custom org backgrounds).
  light: "text-muted-foreground/70 hover:text-muted-foreground",
  // The sidebar, whose background/foreground tokens an org can override via its own color picker.
  sidebar: "text-sidebar-foreground/60 hover:text-sidebar-foreground",
  // The login page - larger and more visible than the other two, closer in weight to avyntor.com's
  // own header lockup rather than fine-print credit text.
  prominent: "text-foreground/80 hover:text-foreground",
} as const

const ICON_SIZE = {
  light: "size-3.5",
  sidebar: "size-3.5",
  prominent: "size-7",
} as const

const LABEL_SIZE = {
  light: "text-xs",
  sidebar: "text-xs",
  prominent: "text-base",
} as const

const SUB_LABEL_SIZE = {
  light: "text-[9px]",
  sidebar: "text-[9px]",
  prominent: "text-[11px]",
} as const

// "Powered by" credit for this app's developer (Avyntor Technologies), distinct from each
// organization's own configurable branding (logo/teamName/colors) elsewhere in the app - this
// never changes per org. Logo + wordmark styling sourced directly from avyntor.com's own site.
export function AvyntorCredit({ variant = "light" }: { variant?: keyof typeof VARIANT_CLASSES }) {
  return (
    <a
      href="https://avyntor.com"
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex w-fit items-center gap-2 transition-colors ${LABEL_SIZE[variant]} ${VARIANT_CLASSES[variant]}`}
    >
      <img src="/avyntor-logo.png" alt="" className={`${ICON_SIZE[variant]} shrink-0`} />
      <span>
        Powered by <span className="font-semibold">Avyntor</span>{" "}
        <span className={`font-mono tracking-[0.22em] ${SUB_LABEL_SIZE[variant]}`}>TECHNOLOGIES</span>
      </span>
    </a>
  )
}
