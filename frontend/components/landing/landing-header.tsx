"use client"

import * as React from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { useScroll, useMotionValueEvent } from "motion/react"

import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { AppLogo } from "@/components/layout/app-logo"

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "FAQ", href: "#faq" },
]

export function LandingHeader() {
  const [open, setOpen] = React.useState(false)
  const [scrolled, setScrolled] = React.useState(false)
  const { scrollY } = useScroll()

  useMotionValueEvent(scrollY, "change", (latest) => {
    setScrolled(latest > 8)
  })

  return (
    <header
      className={
        scrolled
          ? "sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl transition-colors duration-300"
          : "sticky top-0 z-40 border-b border-transparent bg-transparent backdrop-blur-none transition-colors duration-300"
      }
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <AppLogo imgClassName="h-8 max-w-40 object-contain" textClassName="text-base font-semibold tracking-tight text-foreground" />

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-muted-foreground transition-colors hover:text-info"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button render={<Link href="/login" />} className="bg-gradient-to-r from-[#0080F0] to-[#00B0F0] shadow-[0_0_24px_-4px_rgba(0,160,240,0.6)]">
            Log In
          </Button>
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger
            render={
              <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            }
          />
          <SheetContent side="left" className="landing-theme w-72 border-border bg-card p-0 text-foreground">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex h-14 items-center border-b border-border px-4">
              <AppLogo imgClassName="h-7 max-w-32 object-contain" textClassName="text-sm font-semibold tracking-tight text-foreground" />
            </div>
            <nav className="flex flex-col gap-1 p-3">
              {NAV_LINKS.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-2 text-sm text-foreground/80 transition-colors hover:bg-muted hover:text-info"
                >
                  {link.label}
                </a>
              ))}
              <Button render={<Link href="/login" />} className="mt-2 bg-gradient-to-r from-[#0080F0] to-[#00B0F0]">
                Log In
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}
