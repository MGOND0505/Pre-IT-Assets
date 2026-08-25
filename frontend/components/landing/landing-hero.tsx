"use client"

import Link from "next/link"
import { motion } from "motion/react"
import { ArrowRight, ShieldCheck, Layers, Boxes } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

const PARTICLES = [
  { top: "18%", left: "12%", size: 3, delay: 0, duration: 7 },
  { top: "28%", left: "82%", size: 2, delay: 1.2, duration: 6 },
  { top: "62%", left: "8%", size: 2, delay: 0.6, duration: 8 },
  { top: "72%", left: "88%", size: 3, delay: 1.8, duration: 6.5 },
  { top: "40%", left: "50%", size: 2, delay: 0.3, duration: 9 },
  { top: "15%", left: "48%", size: 2, delay: 2, duration: 7.5 },
]

export function LandingHero() {
  return (
    <section className="relative overflow-hidden">
      {/* Ambient grid */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.25]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(0,176,240,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(0,176,240,0.12) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
          maskImage: "radial-gradient(ellipse 80% 60% at 50% 20%, black 40%, transparent 90%)",
          animation: "landing-grid-pan 12s linear infinite",
        }}
      />

      {/* Radial glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-[-12rem] left-1/2 h-[36rem] w-[64rem] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(0,128,240,0.35),rgba(0,176,240,0.08)_60%,transparent_80%)] blur-2xl"
      />

      {/* Orbital rings */}
      <div aria-hidden className="pointer-events-none absolute inset-0 flex items-start justify-center">
        <div className="relative mt-8 size-[36rem] sm:mt-4">
          <div
            className="absolute inset-0 rounded-full border border-info/20"
            style={{ animation: "landing-spin-slow 60s linear infinite" }}
          />
          <div
            className="absolute inset-12 rounded-full border border-primary/15"
            style={{ animation: "landing-spin-slow-reverse 45s linear infinite" }}
          />
          <div
            className="absolute inset-28 rounded-full border border-info/10"
            style={{ animation: "landing-spin-slow 35s linear infinite" }}
          />
        </div>
      </div>

      {/* Floating particles */}
      {PARTICLES.map((p, i) => (
        <div
          key={i}
          aria-hidden
          className="pointer-events-none absolute rounded-full bg-info shadow-[0_0_8px_2px_rgba(0,176,240,0.6)]"
          style={{
            top: p.top,
            left: p.left,
            width: p.size,
            height: p.size,
            animation: `landing-float ${p.duration}s ease-in-out infinite, landing-twinkle ${p.duration * 0.7}s ease-in-out infinite`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}

      <div className="relative mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-24 text-center sm:px-6 sm:py-32">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <Badge variant="outline" className="gap-1.5 border-info/30 bg-info/5 px-3 py-1 text-info">
            <ShieldCheck className="size-3.5" />
            Multi-organization &amp; role-based by design
          </Badge>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="font-display text-4xl leading-tight font-bold tracking-tight text-balance sm:text-5xl lg:text-6xl"
        >
          IT asset, license &amp; vendor management -
          <span className="bg-gradient-to-r from-[#0080F0] to-[#00B0F0] bg-clip-text text-transparent"> built for every organization you run.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="max-w-2xl text-balance text-lg text-muted-foreground"
        >
          One system to track hardware, software licenses, and vendors across as many
          organizations as you manage - each fully isolated, with granular role-based access from
          Super Admin down to individual Team Members.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <Button
            size="lg"
            render={<Link href="/login" />}
            className="gap-1.5 bg-gradient-to-r from-[#0080F0] to-[#00B0F0] shadow-[0_0_32px_-6px_rgba(0,160,240,0.7)] hover:shadow-[0_0_40px_-4px_rgba(0,176,240,0.85)]"
          >
            Log In <ArrowRight className="size-4" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            render={<a href="#features" onClick={(e) => { e.preventDefault(); document.getElementById("features")?.scrollIntoView({ behavior: "smooth" }) }} />}
            className="border-info/30 bg-transparent text-foreground hover:border-info/60 hover:bg-info/10 hover:shadow-[0_0_24px_-8px_rgba(0,176,240,0.6)]"
          >
            See Features
          </Button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-muted-foreground"
        >
          <span className="flex items-center gap-1.5">
            <Layers className="size-4 text-info" /> Per-organization data isolation
          </span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="size-4 text-info" /> 4-tier role-based access
          </span>
          <span className="flex items-center gap-1.5">
            <Boxes className="size-4 text-info" /> Assets, licenses &amp; vendors in one place
          </span>
        </motion.div>
      </div>
    </section>
  )
}
