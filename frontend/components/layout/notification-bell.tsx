"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { apiClient, type ApiEnvelope } from "@/lib/api-client"
import { useOrgHref } from "@/lib/use-org-href"
import { cn } from "@/lib/utils"

type NotificationItem = {
  _id: string
  title: string
  link: string | null
  read: boolean
  createdDate: string
}

type NotificationsResult = {
  items: NotificationItem[]
  unreadCount: number
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diffMs / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

/** No polling, deliberately - fetched once on mount and refreshed whenever the dropdown is
 * opened, rather than a setInterval. This app's shared per-IP rate limit has been exhausted by
 * background polling more than once this session; a bell that only checks in when a person
 * actually looks at it is a fine tradeoff against "instant" unread counts. */
export function NotificationBell() {
  const toOrgHref = useOrgHref()
  const router = useRouter()
  const [items, setItems] = React.useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = React.useState(0)

  const load = React.useCallback(async () => {
    try {
      const res = await apiClient.get<ApiEnvelope<NotificationsResult>>("/notifications", { params: { limit: 5 } })
      setItems(res.data.data.items)
      setUnreadCount(res.data.data.unreadCount)
    } catch {
      // Silent - a bell icon failing to load is not worth surfacing a toast for.
    }
  }, [])

  React.useEffect(() => {
    load()
  }, [load])

  async function handleSelect(notification: NotificationItem) {
    if (!notification.read) {
      try {
        await apiClient.patch(`/notifications/${notification._id}/read`)
        setUnreadCount((c) => Math.max(0, c - 1))
        setItems((prev) => prev.map((n) => (n._id === notification._id ? { ...n, read: true } : n)))
      } catch {
        // Navigate anyway - a failed read-mark shouldn't block getting to the linked record.
      }
    }
    if (notification.link) router.push(toOrgHref(notification.link))
  }

  async function handleMarkAllRead() {
    try {
      await apiClient.patch("/notifications/read-all")
      setUnreadCount(0)
      setItems((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch {
      // No toast - a quiet no-op is fine, the badge just stays as-is.
    }
  }

  return (
    <DropdownMenu onOpenChange={(open) => open && load()}>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="size-5" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-1 -top-1 h-4 min-w-4 justify-center rounded-full px-1 text-[10px]"
              >
                {unreadCount > 9 ? "9+" : unreadCount}
              </Badge>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="text-xs font-normal text-muted-foreground hover:text-foreground hover:underline"
            >
              Mark all as read
            </button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-4 text-center text-sm text-muted-foreground">No notifications yet.</p>
        ) : (
          items.map((n) => (
            <DropdownMenuItem key={n._id} onClick={() => handleSelect(n)} className="flex flex-col items-start gap-0.5">
              <span className={cn("text-sm", !n.read && "font-medium")}>{n.title}</span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {!n.read && <span className="size-1.5 rounded-full bg-primary" />}
                {timeAgo(n.createdDate)}
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem render={<Link href={toOrgHref("/notifications")} />} className="justify-center text-sm">
          View all
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
