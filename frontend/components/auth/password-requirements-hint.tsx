"use client"

import { Check, X } from "lucide-react"

import { checkPasswordRequirements, type PasswordPolicy } from "@/lib/password-policy"
import { cn } from "@/lib/utils"

/** Live checklist of password rules, driven by the org's (or the fixed baseline) policy - shown
 * under every password-entry field so the requirement is visible before a submit attempt fails. */
export function PasswordRequirementsHint({ password, policy }: { password: string; policy: PasswordPolicy }) {
  const requirements = checkPasswordRequirements(password, policy)

  return (
    <ul className="flex flex-col gap-1 text-xs">
      {requirements.map((req) => (
        <li
          key={req.key}
          className={cn("flex items-center gap-1.5", req.met ? "text-success" : "text-muted-foreground")}
        >
          {req.met ? <Check className="size-3" /> : <X className="size-3" />}
          {req.label}
        </li>
      ))}
    </ul>
  )
}
