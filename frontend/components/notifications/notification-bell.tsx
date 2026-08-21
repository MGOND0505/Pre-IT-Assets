"use client"

import * as React from "react"
import { Bell } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

type Notification = {
  _id: string
  title: string
  message: string
  isRead: boolean
  createdAt: string
}

export function NotificationBell() {
  const { user } = useAuth()
  const [items, setItems] = React.useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = React.useState(0)

  const load = React.useCallback(async () => {
    if (!user) return
    try {
      const res = await apiClient.get<ApiEnvelope<{ items: Notification[]; unreadCount: number }>>(
        "/notifications"
      )
      setItems(res.data.data.items)
      setUnreadCount(res.data.data.unreadCount)
    } catch {
      // Silently ignore - the bell just stays empty if this fails.
    }
  }, [user])

  React.useEffect(() => {
    load()
  }, [load])

  async function markRead(id: string) {
    try {
      await apiClient.patch(`/notifications/${id}/read`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  async function markAllRead() {
    try {
      await apiClient.patch("/notifications/read-all")
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err))
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -top-1 -right-1 h-4 min-w-4 justify-center px-1 text-[10px]"
              >
                {unreadCount}
              </Badge>
            )}
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b p-2">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              Mark all read
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No notifications.</p>
          ) : (
            items.map((n) => (
              <button
                key={n._id}
                onClick={() => !n.isRead && markRead(n._id)}
                className={cn(
                  "flex w-full flex-col gap-0.5 border-b p-3 text-left text-sm last:border-b-0 hover:bg-muted",
                  !n.isRead && "bg-primary/5"
                )}
              >
                <span className="font-medium">{n.title}</span>
                <span className="text-muted-foreground">{n.message}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(n.createdAt).toLocaleString()}
                </span>
              </button>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
