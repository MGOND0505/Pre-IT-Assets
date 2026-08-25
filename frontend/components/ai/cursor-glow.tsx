"use client"

import * as React from "react"
import { useReducedMotion } from "motion/react"

/**
 * A very subtle radial glow that follows the pointer - purely decorative, desktop-with-a-mouse
 * only. Disabled for touch/coarse-pointer devices (tablet/mobile), for `prefers-reduced-motion`,
 * and updates via direct style writes on a ref (not React state) so it never triggers a
 * re-render on every mousemove.
 */
export function CursorGlow() {
  const ref = React.useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const [enabled, setEnabled] = React.useState(false)

  React.useEffect(() => {
    const isFinePointer = window.matchMedia("(pointer: fine)").matches
    setEnabled(isFinePointer && !prefersReducedMotion)
  }, [prefersReducedMotion])

  React.useEffect(() => {
    if (!enabled) return
    function onMove(e: MouseEvent) {
      const el = ref.current
      if (!el) return
      el.style.transform = `translate3d(${e.clientX - 100}px, ${e.clientY - 100}px, 0)`
      el.style.opacity = "1"
    }
    function onLeave() {
      const el = ref.current
      if (el) el.style.opacity = "0"
    }
    window.addEventListener("mousemove", onMove)
    document.documentElement.addEventListener("mouseleave", onLeave)
    return () => {
      window.removeEventListener("mousemove", onMove)
      document.documentElement.removeEventListener("mouseleave", onLeave)
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 z-[60] size-[200px] rounded-full opacity-0 transition-opacity duration-300"
      style={{
        background: "radial-gradient(circle, color-mix(in oklch, var(--ai-from) 10%, transparent) 0%, transparent 70%)",
        willChange: "transform",
      }}
    />
  )
}
