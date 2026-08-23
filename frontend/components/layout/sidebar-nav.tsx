"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"
import { isNavGroup, navConfig, type NavLeaf } from "@/lib/nav-config"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"

function Leaf({ item, pathname }: { item: NavLeaf; pathname: string }) {
  const active = pathname === item.href
  const content = (
    <span
      className={cn(
        "flex items-center justify-between rounded-md px-3 py-2 text-sm transition-colors",
        item.disabled
          ? "cursor-not-allowed text-muted-foreground/50"
          : active
            ? "bg-primary/10 font-medium text-primary"
            : "text-foreground/80 hover:bg-muted hover:text-foreground"
      )}
    >
      {item.label}
      {item.disabled && (
        <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
          Soon
        </span>
      )}
    </span>
  )

  if (item.disabled) {
    return <div aria-disabled>{content}</div>
  }

  return <Link href={item.href}>{content}</Link>
}

export function SidebarNav() {
  const pathname = usePathname()
  const { user } = useAuth()

  const visibleLeaf = (item: NavLeaf) => {
    if (!item.permission) return true
    if (item.permission === "admin") return Boolean(user?.isAdmin)
    return can(user, item.permission.area, item.permission.action)
  }

  return (
    <nav className="flex flex-col gap-4 p-3">
      {navConfig.map((entry) => {
        if (isNavGroup(entry)) {
          const children = entry.children?.filter(visibleLeaf) ?? []
          if (children.length === 0) return null

          return (
            <div key={entry.label} className="flex flex-col gap-1">
              <div className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {entry.label}
              </div>
              {children.map((child) => (
                <Leaf key={child.href} item={child} pathname={pathname} />
              ))}
            </div>
          )
        }

        if (!visibleLeaf(entry)) return null

        return <Leaf key={entry.href} item={entry} pathname={pathname} />
      })}
    </nav>
  )
}
