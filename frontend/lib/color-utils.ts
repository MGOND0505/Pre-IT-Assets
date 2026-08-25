export function isValidHexColor(value: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(value)
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace("#", "")
  return [parseInt(clean.slice(0, 2), 16), parseInt(clean.slice(2, 4), 16), parseInt(clean.slice(4, 6), 16)]
}

/** Perceptual luminance heuristic - good enough to pick readable black/white text, not a WCAG-precise formula. */
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

export function isLightColor(hex: string): boolean {
  return relativeLuminance(hex) > 0.6
}

/** A CSS var override set for a container painted with `bgColor`, so nested Tailwind
 * utilities that read --card/--foreground/--muted/--primary stay legible on any custom color. */
export function surfaceOverrideVars(bgColor: string, surfaceVar: "--card" | "--background"): React.CSSProperties {
  const light = isLightColor(bgColor)
  const fg = light ? "17, 17, 17" : "250, 250, 250"

  return {
    [surfaceVar]: bgColor,
    "--foreground": `rgb(${fg})`,
    "--primary": `rgb(${fg})`,
    "--muted-foreground": `rgba(${fg}, 0.65)`,
    "--muted": `rgba(${fg}, 0.08)`,
    "--border": `rgba(${fg}, 0.12)`,
  } as React.CSSProperties
}

/** Same idea as `surfaceOverrideVars`, but for the sidebar's own dedicated token set
 * (--sidebar/--sidebar-foreground/...) rather than the generic --card/--foreground ones - the
 * sidebar always uses its own tokens now (a navy surface by default), so a custom brand color
 * for it must override those specifically, not --card. */
export function sidebarOverrideVars(bgColor: string): React.CSSProperties {
  const light = isLightColor(bgColor)
  const fg = light ? "17, 17, 17" : "250, 250, 250"

  return {
    "--sidebar": bgColor,
    "--sidebar-foreground": `rgb(${fg})`,
    "--sidebar-accent": `rgba(${fg}, 0.08)`,
    "--sidebar-accent-foreground": `rgb(${fg})`,
    "--sidebar-border": `rgba(${fg}, 0.12)`,
  } as React.CSSProperties
}
