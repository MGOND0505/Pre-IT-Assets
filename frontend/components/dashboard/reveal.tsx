"use client"

import * as React from "react"
import { motion, useReducedMotion, type Variants } from "motion/react"

const containerVariants: Variants = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.06, delayChildren: 0.02 },
  },
}

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
}

/** Wraps a grid/row of children (KPI tiles, chart cards, ...) so they fade+rise in with a
 * short stagger on mount, instead of popping in all at once. Purely presentational - the
 * children's own layout classes (grid, flex, ...) go on this element unchanged. Falls back
 * to an instant, unanimated render when the reader prefers reduced motion. */
export function RevealGroup({ className, children }: { className?: string; children: React.ReactNode }) {
  const prefersReducedMotion = useReducedMotion()
  if (prefersReducedMotion) return <div className={className}>{children}</div>

  return (
    <motion.div className={className} variants={containerVariants} initial="hidden" animate="show">
      {children}
    </motion.div>
  )
}

export function RevealItem({ className, children }: { className?: string; children: React.ReactNode }) {
  const prefersReducedMotion = useReducedMotion()
  if (prefersReducedMotion) return <div className={className}>{children}</div>

  return (
    <motion.div className={className} variants={itemVariants}>
      {children}
    </motion.div>
  )
}
