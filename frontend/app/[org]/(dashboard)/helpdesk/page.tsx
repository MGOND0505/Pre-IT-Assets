"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"
import { Ticket as TicketIcon, Inbox, Clock3, CheckCircle2, AlertTriangle, Timer } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/common/data-table"
import { Pagination } from "@/components/common/pagination"
import { TicketStatusBadge, TICKET_STATUSES, type TicketStatus } from "@/components/helpdesk/ticket-status-badge"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can } from "@/lib/permissions"
import { useHelpdeskPriorityOptions } from "@/lib/use-lookup-options"
import { useOrgHref } from "@/lib/use-org-href"

type Ticket = {
  _id: string
  ticketId: string
  subject: string
  category: { _id: string; name: string } | null
  priority: { _id: string; name: string; color: string } | null
  requester: { _id: string; name: string; email: string } | null
  assignedAgent: { _id: string; name: string; email: string } | null
  status: TicketStatus
  tier: "L1" | "L2" | "L3"
  slaResolutionDueAt: string | null
  createdDate: string
}

type Paginated = { items: Ticket[]; total: number; page: number; totalPages: number }

type Stats = {
  total: number
  byStatus: Record<string, number>
  slaBreached: number
  avgResponseMinutes: number | null
  avgResolutionMinutes: number | null
}

const ALL = "__all__"

function KpiCard({ label, value, icon: Icon }: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="flex items-start justify-between gap-2 pt-6">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-muted-foreground">{label}</span>
          <span className="text-2xl font-semibold tracking-tight">{value}</span>
        </div>
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  )
}

export default function HelpdeskPage() {
  const router = useRouter()
  const toOrgHref = useOrgHref()
  const { user, loading: authLoading } = useAuth()
  const { items: priorities } = useHelpdeskPriorityOptions()
  const [data, setData] = React.useState<Paginated | null>(null)
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [search, setSearch] = React.useState("")
  const [status, setStatus] = React.useState<string>(ALL)
  const [priority, setPriority] = React.useState<string>(ALL)

  const canView = can(user, "helpdesk", "view")
  const canCreate = can(user, "helpdesk", "create")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const [ticketsRes, statsRes] = await Promise.all([
        apiClient.get<ApiEnvelope<Paginated>>("/helpdesk", {
          params: {
            page,
            limit: 15,
            search: search || undefined,
            status: status === ALL ? undefined : status,
            priority: priority === ALL ? undefined : priority,
          },
        }),
        apiClient.get<ApiEnvelope<Stats>>("/helpdesk/stats"),
      ])
      setData(ticketsRes.data.data)
      setStats(statsRes.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load tickets"))
    } finally {
      setLoading(false)
    }
  }, [page, search, status, priority])

  React.useEffect(() => {
    if (canView) load()
  }, [canView, load])

  const columns: ColumnDef<Ticket, unknown>[] = [
    {
      accessorKey: "ticketId",
      header: "Ticket",
      cell: ({ row }) => (
        <Link href={toOrgHref(`/helpdesk/${row.original._id}`)} className="font-medium text-primary hover:underline">
          {row.original.ticketId}
        </Link>
      ),
    },
    { accessorKey: "subject", header: "Subject" },
    {
      id: "priority",
      header: "Priority",
      cell: ({ row }) =>
        row.original.priority ? (
          <span className="flex items-center gap-1.5">
            <span className="size-2 rounded-full" style={{ backgroundColor: row.original.priority.color }} />
            {row.original.priority.name}
          </span>
        ) : (
          "-"
        ),
    },
    { id: "category", header: "Category", cell: ({ row }) => row.original.category?.name ?? "-" },
    { id: "requester", header: "Requester", cell: ({ row }) => row.original.requester?.name ?? "-" },
    { id: "agent", header: "Agent", cell: ({ row }) => row.original.assignedAgent?.name ?? "Unassigned" },
    { accessorKey: "tier", header: "Tier" },
    { id: "status", header: "Status", cell: ({ row }) => <TicketStatusBadge status={row.original.status} /> },
  ]

  if (authLoading) return null
  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Helpdesk</h1>
          <p className="text-sm text-muted-foreground">Track and manage support tickets.</p>
        </div>
        {canCreate && <Button render={<Link href={toOrgHref("/helpdesk/add")} />}>Add Ticket</Button>}
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <KpiCard label="Total" value={stats.total} icon={TicketIcon} />
          <KpiCard label="Open" value={stats.byStatus["Open"] ?? 0} icon={Inbox} />
          <KpiCard label="Pending" value={stats.byStatus["Pending"] ?? 0} icon={Clock3} />
          <KpiCard label="Resolved" value={stats.byStatus["Resolved"] ?? 0} icon={CheckCircle2} />
          <KpiCard label="SLA Breached" value={stats.slaBreached} icon={AlertTriangle} />
          <KpiCard label="Avg. Resolution" value={stats.avgResolutionMinutes ? `${Math.round(stats.avgResolutionMinutes / 60)}h` : "-"} icon={Timer} />
        </div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center">
        <Input
          placeholder="Search by ticket ID or subject..."
          value={search}
          onChange={(e) => {
            setPage(1)
            setSearch(e.target.value)
          }}
          className="w-full md:max-w-sm"
        />
        <Select
          value={status}
          onValueChange={(v) => {
            setPage(1)
            setStatus(v ?? ALL)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {TICKET_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={priority}
          onValueChange={(v) => {
            setPage(1)
            setPriority(v ?? ALL)
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All priorities</SelectItem>
            {priorities.map((p) => (
              <SelectItem key={p._id} value={p._id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={loading}
        emptyMessage="No tickets yet."
        onRowClick={(row) => router.push(toOrgHref(`/helpdesk/${row._id}`))}
      />
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}
    </div>
  )
}
