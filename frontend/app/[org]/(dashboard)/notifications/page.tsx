"use client"

import * as React from "react"
import { toast } from "sonner"
import { Bell } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Pagination } from "@/components/common/pagination"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
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
  total: number
  page: number
  totalPages: number
  unreadCount: number
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  })
}

export default function NotificationsPage() {
  const toOrgHref = useOrgHref()
  const [data, setData] = React.useState<NotificationsResult | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<NotificationsResult>>("/notifications", { params: { page, limit: 20 } })
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load notifications"))
    } finally {
      setLoading(false)
    }
  }, [page])

  React.useEffect(() => {
    load()
  }, [load])

  async function handleOpen(notification: NotificationItem) {
    if (!notification.read) {
      try {
        await apiClient.patch(`/notifications/${notification._id}/read`)
        setData((prev) =>
          prev
            ? {
                ...prev,
                unreadCount: Math.max(0, prev.unreadCount - 1),
                items: prev.items.map((n) => (n._id === notification._id ? { ...n, read: true } : n)),
              }
            : prev
        )
      } catch {
        // Navigate anyway - a failed read-mark shouldn't block getting to the linked record.
      }
    }
    if (notification.link) window.location.href = toOrgHref(notification.link)
  }

  async function handleMarkAllRead() {
    try {
      await apiClient.patch("/notifications/read-all")
      toast.success("All notifications marked as read")
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not mark notifications as read"))
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted-foreground">Updates about your own tickets and tasks.</p>
        </div>
        {data && data.unreadCount > 0 && (
          <Button variant="outline" onClick={handleMarkAllRead}>
            Mark all as read
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading...</p>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
            <Bell className="size-8 opacity-50" />
            <p className="text-sm">No notifications yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col divide-y p-0">
            {data.items.map((n) => (
              <button
                key={n._id}
                type="button"
                onClick={() => handleOpen(n)}
                className={cn(
                  "flex flex-col items-start gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                  !n.read && "bg-muted/30"
                )}
              >
                <span className={cn("text-sm", !n.read && "font-medium")}>{n.title}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {!n.read && <span className="size-1.5 shrink-0 rounded-full bg-primary" />}
                  {formatDate(n.createdDate)}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}
    </div>
  )
}
