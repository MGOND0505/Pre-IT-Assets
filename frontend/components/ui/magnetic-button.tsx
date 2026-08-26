"use client"

import * as React from "react"
import { useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

// How strongly the button follows the cursor, and how far it's ever allowed to drift - kept
// small on purpose so this reads as "premium and subtle," not a gimmick.
const MAGNETIC_STRENGTH = 0.25
const MAX_OFFSET_PX = 6

/**
 * Wraps a single "important" call-to-action button (Add Asset, Create Ticket, Log In, ...) with
 * a subtle cursor-following pull and a small click ripple. Deliberately NOT built into the
 * shared Button component itself - applying this to every button app-wide (table row actions,
 * toolbar icons, ...) would be exactly the "excessive"/"gaming-style" effect the brief asks to
 * avoid, so it's opt-in per usage instead.
 *
 * The transform lives on this wrapper, not the button's own DOM node, so it never touches
 * Base UI's ref/prop-merging internals - zero risk of interfering with the button's own click
 * handling. A separate inner overlay (with its own overflow-hidden + matching radius) contains
 * the ripple so it doesn't clip the button's own shadow/focus ring.
 */
export function MagneticButton({
  children,
  className,
  radiusClassName = "rounded-lg",
}: {
  children: React.ReactNode
  className?: string
  /** Must match the wrapped button's own border-radius so the ripple stays within its shape. */
  radiusClassName?: string
}) {
  const wrapperRef = React.useRef<HTMLDivElement>(null)
  const rippleLayerRef = React.useRef<HTMLDivElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const [pointerFine, setPointerFine] = React.useState(false)

  React.useEffect(() => {
    setPointerFine(typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches)
  }, [])

  const magneticEnabled = pointerFine && !prefersReducedMotion

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (!magneticEnabled || !wrapperRef.current) return
    const rect = wrapperRef.current.getBoundingClientRect()
    const relX = e.clientX - (rect.left + rect.width / 2)
    const relY = e.clientY - (rect.top + rect.height / 2)
    const offsetX = Math.max(-MAX_OFFSET_PX, Math.min(MAX_OFFSET_PX, relX * MAGNETIC_STRENGTH))
    const offsetY = Math.max(-MAX_OFFSET_PX, Math.min(MAX_OFFSET_PX, relY * MAGNETIC_STRENGTH))
    wrapperRef.current.style.transform = `translate(${offsetX}px, ${offsetY}px)`
  }

  function handleMouseLeave() {
    if (wrapperRef.current) wrapperRef.current.style.transform = ""
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (prefersReducedMotion || !rippleLayerRef.current) return
    const rect = rippleLayerRef.current.getBoundingClientRect()
    const size = Math.max(rect.width, rect.height) * 1.6
    const ripple = document.createElement("span")
    ripple.style.cssText = [
      "position:absolute",
      `left:${e.clientX - rect.left - size / 2}px`,
      `top:${e.clientY - rect.top - size / 2}px`,
      `width:${size}px`,
      `height:${size}px`,
      "border-radius:9999px",
      "background:color-mix(in oklch, white 35%, transparent)",
      "pointer-events:none",
      "animation:btn-ripple 500ms ease-out forwards",
    ].join(";")
    rippleLayerRef.current.appendChild(ripple)
    ripple.addEventListener("animationend", () => ripple.remove())
  }

  return (
    <div
      ref={wrapperRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onPointerDown={handlePointerDown}
      className={cn("relative inline-block transition-transform duration-150 ease-out", className)}
    >
      {children}
      <div ref={rippleLayerRef} aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", radiusClassName)} />
    </div>
  )
}
