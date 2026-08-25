"use client"

import Link from "next/link"
import { motion } from "motion/react"

import { Button } from "@/components/ui/button"
import { AppLogo } from "@/components/layout/app-logo"

export function LandingCta() {
  return (
    <section className="relative border-t border-border">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_100%_at_50%_100%,rgba(0,128,240,0.14),transparent_70%)]"
      />
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-80px" }}
        transition={{ duration: 0.5 }}
        className="relative mx-auto flex max-w-4xl flex-col items-center gap-4 px-4 py-16 text-center sm:px-6"
      >
        <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Ready to sign in?</h2>
        <p className="max-w-lg text-muted-foreground">
          If your organization is already set up, log in to get started.
        </p>
        <Button
          size="lg"
          render={<Link href="/login" />}
          className="bg-gradient-to-r from-[#0080F0] to-[#00B0F0] shadow-[0_0_32px_-6px_rgba(0,160,240,0.7)] hover:shadow-[0_0_40px_-4px_rgba(0,176,240,0.85)]"
        >
          Log In
        </Button>
      </motion.div>
    </section>
  )
}

export function LandingFooter() {
  return (
    <footer className="relative border-t border-border bg-[#000010]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden opacity-40"
        style={{
          backgroundImage: "radial-gradient(rgba(0,176,240,0.25) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
          maskImage: "radial-gradient(ellipse 70% 100% at 50% 0%, black 0%, transparent 70%)",
        }}
      />
      <div className="relative mx-auto flex max-w-6xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-2">
          <AppLogo imgClassName="h-7 max-w-36 object-contain" textClassName="text-sm font-semibold tracking-tight text-foreground" />
          <p className="max-w-sm text-sm text-muted-foreground">
            Multi-organization IT asset, license, and vendor management with role-based delegated
            access.
          </p>
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <a href="#features" className="text-muted-foreground transition-colors hover:text-info">
            Features
          </a>
          <a href="#faq" className="text-muted-foreground transition-colors hover:text-info">
            FAQ
          </a>
          <Link href="/login" className="text-muted-foreground transition-colors hover:text-info">
            Log In
          </Link>
        </div>
      </div>

      <div className="relative border-t border-border px-4 py-4 text-center text-xs text-muted-foreground sm:px-6">
        Access is provisioned by your Super Admin. &copy; {new Date().getFullYear()} All rights reserved.
      </div>
    </footer>
  )
}
