"use client"

import * as React from "react"
import Link from "next/link"
import { Boxes, LifeBuoy, ListChecks, KeyRound } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { apiClient, type ApiEnvelope } from "@/lib/api-client"
import { useAuth, type UserRole } from "@/lib/auth-context"
import { useOrgHref } from "@/lib/use-org-href"

const ROLE_LABEL: Record<UserRole, string> = {
  superAdmin: "Super Admin",
  subSuperAdmin: "Sub-Super Admin",
  orgAdmin: "Org Admin",
  teamMember: "Team Member",
}

/** "Assigned to you" counts - each endpoint already scopes itself to the current user for anyone
 * who isn't privileged to see the whole org's records (see assets.service.ts#canViewAllAssets,
 * helpdesk.service.ts#canViewAllTickets, tasks.service.ts#canViewAllTasks), so a plain `total`
 * read here is already the right number for a Basic User - no separate "mine" endpoint needed. */
function useAssignedCount(path: string) {
  const [count, setCount] = React.useState<number | null>(null)

  React.useEffect(() => {
    let cancelled = false
    apiClient
      .get<ApiEnvelope<{ total: number }>>(path, { params: { limit: 1 } })
      .then((res) => {
        if (!cancelled) setCount(res.data.data.total)
      })
      .catch(() => {
        if (!cancelled) setCount(null)
      })
    return () => {
      cancelled = true
    }
  }, [path])

  return count
}

export default function ProfilePage() {
  const { user, loading } = useAuth()
  const toOrgHref = useOrgHref()

  const assetCount = useAssignedCount("/assets")
  const ticketCount = useAssignedCount("/helpdesk")
  const taskCount = useAssignedCount("/tasks")

  if (loading || !user) return null

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My Profile</h1>
        <p className="text-sm text-muted-foreground">Your account details and what's assigned to you.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Name</span>
            <span className="font-medium">{user.name}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Email</span>
            <span className="font-medium">{user.email}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Role</span>
            <Badge variant={user.isAdmin ? "default" : "outline"}>{ROLE_LABEL[user.role]}</Badge>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Department</span>
            <span className="font-medium">{user.department?.name ?? "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Location</span>
            <span className="font-medium">{user.location?.name ?? "-"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Status</span>
            <Badge variant={user.status === "Active" ? "success" : "outline"}>{user.status}</Badge>
          </div>
          <div className="pt-2">
            <Button variant="outline" size="sm" render={<Link href={toOrgHref("/profile/change-password")} />}>
              <KeyRound className="size-3.5" />
              Change password
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assigned to you</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Link
            href={toOrgHref("/assets")}
            className="flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-accent"
          >
            <Boxes className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">Assets</span>
            <span className="font-medium">{assetCount ?? "-"}</span>
          </Link>
          <Link
            href={toOrgHref("/helpdesk")}
            className="flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-accent"
          >
            <LifeBuoy className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">Tickets</span>
            <span className="font-medium">{ticketCount ?? "-"}</span>
          </Link>
          <Link
            href={toOrgHref("/tasks")}
            className="flex items-center gap-3 rounded-lg border p-3 text-sm transition-colors hover:bg-accent"
          >
            <ListChecks className="size-4 shrink-0 text-muted-foreground" />
            <span className="flex-1">Tasks</span>
            <span className="font-medium">{taskCount ?? "-"}</span>
          </Link>
        </CardContent>
      </Card>
    </div>
  )
}
