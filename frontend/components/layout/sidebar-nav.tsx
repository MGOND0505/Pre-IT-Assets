"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { isNavGroup, navConfig, type NavGroup, type NavLeaf } from "@/lib/nav-config"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useOrgHref } from "@/lib/use-org-href"

function Leaf({
  item,
  pathname,
  toOrgHref,
  nested = false,
}: {
  item: NavLeaf
  pathname: string
  toOrgHref: (path: string) => string
  nested?: boolean
}) {
  const href = item.absolute ? item.href : toOrgHref(item.href)
  const active = pathname === href
  const Icon = item.icon

  const content = (
    <span
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors duration-150",
        nested && "py-1.5 text-[0.85rem]",
        item.disabled
          ? "cursor-not-allowed text-sidebar-foreground/35"
          : active
            ? "bg-sidebar-accent font-medium text-sidebar-primary"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
      )}
    >
      {Icon && <Icon className={cn("size-4 shrink-0", active ? "text-sidebar-primary" : "text-sidebar-foreground/50")} />}
      <span className="flex-1">{item.label}</span>
      {item.disabled && (
        <span className="rounded bg-sidebar-accent px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-sidebar-foreground/60">
          Soon
        </span>
      )}
    </span>
  )

  const wrapped = nested ? (
    <span className="relative flex before:absolute before:left-[15px] before:top-0 before:h-full before:w-px before:bg-sidebar-border">
      <span className="w-6 shrink-0" />
      <span className="flex-1">{content}</span>
    </span>
  ) : (
    content
  )

  if (item.disabled) {
    return <div aria-disabled>{wrapped}</div>
  }

  return (
    <Link href={href} className="relative block" aria-current={active ? "page" : undefined}>
      {active && (
        <span className="absolute inset-y-1 left-0 w-0.5 rounded-full bg-sidebar-primary" aria-hidden />
      )}
      {wrapped}
    </Link>
  )
}

function Group({
  entry,
  children,
  pathname,
  toOrgHref,
}: {
  entry: NavGroup
  children: NavLeaf[]
  pathname: string
  toOrgHref: (path: string) => string
}) {
  const groupIsActive = children.some((child) => pathname === (child.absolute ? child.href : toOrgHref(child.href)))
  const [open, setOpen] = React.useState(groupIsActive)
  const prefersReducedMotion = useReducedMotion()
  const Icon = entry.icon

  return (
    <div className="flex flex-col">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors duration-150",
          groupIsActive && !open ? "text-sidebar-primary" : "text-sidebar-foreground/85 hover:bg-sidebar-accent"
        )}
        aria-expanded={open}
      >
        {Icon && (
          <Icon className={cn("size-4 shrink-0", groupIsActive ? "text-sidebar-primary" : "text-sidebar-foreground/50")} />
        )}
        <span className="flex-1 text-left">{entry.label}</span>
        <ChevronRight
          className={cn("size-3.5 shrink-0 text-sidebar-foreground/40 transition-transform duration-200", open && "rotate-90")}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={prefersReducedMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-0.5 py-1">
              {children.map((child) => (
                <Leaf key={child.href} item={child} pathname={pathname} toOrgHref={toOrgHref} nested />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function SidebarNav() {
  const pathname = usePathname()
  const { user } = useAuth()
  const toOrgHref = useOrgHref()

  const visibleLeaf = (item: NavLeaf) => {
    if (item.superAdminOnly) return user?.role === "superAdmin"
    if (item.adminOnly && !user?.isAdmin) return false
    if (item.employeeHidden && user?.employeeTier === "employee") return false
    if (item.employeeOnly && user?.employeeTier !== "employee") return false
    if (item.permission && !can(user, item.permission.area, item.permission.action)) return false
    if (item.requiresModule && user?.role !== "superAdmin" && !user?.organization?.enabledModules.includes(item.requiresModule)) {
      return false
    }
    return true
  }

  return (
    <nav className="flex flex-col gap-1 p-3">
      {navConfig.map((entry) => {
        if (isNavGroup(entry)) {
          const children = entry.children?.filter(visibleLeaf) ?? []
          if (children.length === 0) return null

          return <Group key={entry.label} entry={entry} children={children} pathname={pathname} toOrgHref={toOrgHref} />
        }

        if (!visibleLeaf(entry)) return null

        return <Leaf key={entry.label} item={entry} pathname={pathname} toOrgHref={toOrgHref} />
      })}
    </nav>
  )
}
