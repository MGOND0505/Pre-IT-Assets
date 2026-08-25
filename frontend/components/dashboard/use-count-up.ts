import * as React from "react"
import { useReducedMotion } from "motion/react"

/** Animates a number counting up to `value` on mount/change - a small "alive" touch on
 * KPI tiles. Skips straight to the final value when the reader prefers reduced motion,
 * and on every re-render after the first (only the initial mount/value-change counts up,
 * a refresh with the same value doesn't replay). */
export function useCountUp(value: number, durationMs = 700): number {
  const prefersReducedMotion = useReducedMotion()
  const [display, setDisplay] = React.useState(prefersReducedMotion ? value : 0)
  const fromRef = React.useRef(0)

  React.useEffect(() => {
    if (prefersReducedMotion) {
      setDisplay(value)
      return
    }

    const from = fromRef.current
    const delta = value - from
    if (delta === 0) return

    let frame: number
    const start = performance.now()

    function tick(now: number) {
      const elapsed = now - start
      const progress = Math.min(1, elapsed / durationMs)
      // ease-out cubic - fast start, gentle settle
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(from + delta * eased))
      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      } else {
        fromRef.current = value
      }
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, durationMs, prefersReducedMotion])

  return display
}
