"use client"

import * as React from "react"
import { ChevronDown } from "lucide-react"
import { motion } from "motion/react"

import { cn } from "@/lib/utils"

const FAQS = [
  {
    question: "Is my organization's data isolated from other organizations?",
    answer:
      "Yes. Every organization's users, assets, licenses, and settings are fully separated from every other organization on the platform - there is no shared data between organizations.",
  },
  {
    question: "Who can create new organizations or users?",
    answer:
      "A Super Admin creates organizations and their first Organization Admin. From there, each Organization Admin manages the users within their own organization, with granular per-module permissions.",
  },
  {
    question: "What is a Sub-Super Admin?",
    answer:
      "A Sub-Super Admin is a delegated account that can be granted access to a specific set of organizations - with its own independent Read Only, Read/Write, or Full Access grant per organization - without being a full system-wide Super Admin.",
  },
  {
    question: "What happens if my organization's subscription expires?",
    answer:
      "Access is automatically restricted once the validity period (plus any grace period) passes, until a Super Admin extends it. Your data is preserved - it simply becomes inaccessible until renewed.",
  },
  {
    question: "Can access be limited to specific modules, like Assets or Licenses only?",
    answer:
      "Yes. Every user's permissions are set per module and per action (view, create, update, delete, import, export), so access can be as broad or as narrow as needed.",
  },
]

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = React.useState(false)

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card shadow-soft-sm transition-all",
        open && "border-info/30 shadow-[0_0_24px_-10px_rgba(0,176,240,0.5)]"
      )}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        aria-expanded={open}
      >
        <span className="font-medium text-foreground">{question}</span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180 text-info")}
        />
      </button>
      {open && <div className="px-5 pb-4 text-sm text-muted-foreground">{answer}</div>}
    </div>
  )
}

export function LandingFaq() {
  return (
    <section id="faq" className="scroll-mt-16 py-20">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Frequently asked questions</h2>
        </div>

        <div className="mt-10 flex flex-col gap-3">
          {FAQS.map((faq, i) => (
            <motion.div
              key={faq.question}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
            >
              <FaqItem {...faq} />
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  )
}
