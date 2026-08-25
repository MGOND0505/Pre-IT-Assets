"use client"

import { motion } from "motion/react"
import {
  Boxes,
  KeyRound,
  Store,
  Building2,
  BarChart3,
  ScrollText,
  ShieldCheck,
  Layers,
  Users,
} from "lucide-react"

const MODULE_FEATURES = [
  {
    icon: Boxes,
    title: "IT Asset Tracking",
    description: "Track every device end to end - assignment, status, warranty, and AMC coverage in one record.",
  },
  {
    icon: KeyRound,
    title: "License Management",
    description: "Manage software licenses, seats, renewal dates, and expiry alerts before they lapse.",
  },
  {
    icon: Store,
    title: "Vendor Management",
    description: "Keep vendor records - including GST and PAN details - organized and audit-ready.",
  },
  {
    icon: Building2,
    title: "Departments & Locations",
    description: "Organize people and equipment by department and physical location.",
  },
  {
    icon: BarChart3,
    title: "Reports",
    description: "Real-time visibility into asset status, license utilization, and organizational KPIs.",
  },
  {
    icon: ScrollText,
    title: "Audit Logs",
    description: "Every create, update, and access change is recorded - who did what, and when.",
  },
]

const PLATFORM_FEATURES = [
  {
    icon: Layers,
    title: "Per-organization isolation",
    description: "Each organization's data, users, and settings are fully separated from every other organization on the platform.",
  },
  {
    icon: ShieldCheck,
    title: "4-tier role-based access",
    description: "Super Admin, Sub-Super Admin, Organization Admin, and Team Member - each with precisely scoped permissions.",
  },
  {
    icon: Users,
    title: "Granular per-module permissions",
    description: "View, create, update, delete, import, and export - controlled independently for every module, for every user.",
  },
]

function FeatureCard({
  icon: Icon,
  title,
  description,
  index,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  index: number
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay: (index % 3) * 0.08 }}
      className="group h-full rounded-xl border border-border bg-card p-6 shadow-soft-sm transition-all hover:-translate-y-1 hover:border-info/40 hover:shadow-[0_0_28px_-8px_rgba(0,176,240,0.45)]"
    >
      <div className="flex size-10 items-center justify-center rounded-lg bg-info/10 text-info transition-colors group-hover:bg-info/20">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 font-heading text-base font-semibold text-foreground">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </motion.div>
  )
}

export function LandingFeatures() {
  return (
    <section id="features" className="relative scroll-mt-16 border-t border-border py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_60%_100%_at_50%_0%,rgba(0,128,240,0.12),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Everything you need, in one system</h2>
          <p className="mt-3 text-muted-foreground">
            A complete set of modules for managing IT assets and licenses across every organization you run.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {MODULE_FEATURES.map((feature, i) => (
            <FeatureCard key={feature.title} index={i} {...feature} />
          ))}
        </div>

        <div className="mx-auto mt-16 max-w-2xl text-center">
          <h3 className="font-display text-2xl font-bold tracking-tight">Built for multi-organization scale</h3>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {PLATFORM_FEATURES.map((feature, i) => (
            <FeatureCard key={feature.title} index={i} {...feature} />
          ))}
        </div>
      </div>
    </section>
  )
}
