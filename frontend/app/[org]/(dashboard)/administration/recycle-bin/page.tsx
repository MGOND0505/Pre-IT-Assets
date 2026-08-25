"use client"

import * as React from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DataTable } from "@/components/common/data-table"
import { Pagination } from "@/components/common/pagination"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"

type DeletedRecord = {
  _id: string
  deletedAt: string | null
  daysRemaining: number | null
  [key: string]: unknown
}

type Paginated = { items: DeletedRecord[]; total: number; page: number; totalPages: number }

type ModuleConfig = {
  key: string
  label: string
  apiBase: string
  getLabel: (item: DeletedRecord) => string
  getSubtitle?: (item: DeletedRecord) => string
  canPurge?: boolean
}

const MODULES: ModuleConfig[] = [
  {
    key: "assets",
    label: "Assets",
    apiBase: "/assets",
    getLabel: (i) => String(i.name ?? "-"),
    getSubtitle: (i) => String(i.assetId ?? ""),
    canPurge: true,
  },
  {
    key: "licenses",
    label: "Licenses",
    apiBase: "/licenses",
    getLabel: (i) => String(i.softwareName ?? i.productName ?? "-"),
    getSubtitle: (i) => String(i.licenseId ?? ""),
  },
  { key: "vendors", label: "Vendors", apiBase: "/vendors", getLabel: (i) => String(i.name ?? "-") },
  { key: "departments", label: "Departments", apiBase: "/departments", getLabel: (i) => String(i.name ?? "-") },
  { key: "locations", label: "Locations", apiBase: "/locations", getLabel: (i) => String(i.name ?? "-") },
  {
    key: "users",
    label: "Users",
    apiBase: "/users",
    getLabel: (i) => String(i.name ?? "-"),
    getSubtitle: (i) => String(i.email ?? ""),
  },
  {
    key: "tickets",
    label: "Helpdesk Tickets",
    apiBase: "/helpdesk",
    getLabel: (i) => String(i.subject ?? "-"),
    getSubtitle: (i) => String(i.ticketId ?? ""),
  },
  {
    key: "tasks",
    label: "Tasks",
    apiBase: "/tasks",
    getLabel: (i) => String(i.title ?? "-"),
    getSubtitle: (i) => String(i.taskId ?? ""),
  },
  {
    key: "helpdesk-categories",
    label: "Helpdesk Categories",
    apiBase: "/helpdesk-categories",
    getLabel: (i) => String(i.name ?? "-"),
  },
  {
    key: "helpdesk-priorities",
    label: "Helpdesk Priorities",
    apiBase: "/helpdesk-priorities",
    getLabel: (i) => String(i.name ?? "-"),
  },
  { key: "support-teams", label: "Support Teams", apiBase: "/support-teams", getLabel: (i) => String(i.name ?? "-") },
]

export default function RecycleBinPage() {
  const { user, loading: authLoading } = useAuth()
  const [moduleKey, setModuleKey] = React.useState(MODULES[0].key)
  const [data, setData] = React.useState<Paginated | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [pendingRestore, setPendingRestore] = React.useState<DeletedRecord | null>(null)
  const [pendingPurge, setPendingPurge] = React.useState<DeletedRecord | null>(null)

  const activeModule = MODULES.find((m) => m.key === moduleKey) ?? MODULES[0]

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Paginated>>(`${activeModule.apiBase}/deleted`, {
        params: { page, limit: 10 },
      })
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load deleted records"))
    } finally {
      setLoading(false)
    }
  }, [activeModule.apiBase, page])

  React.useEffect(() => {
    if (user?.isAdmin) load()
  }, [user?.isAdmin, load])

  function handleModuleChange(key: string) {
    setModuleKey(key)
    setPage(1)
  }

  async function handleRestore(record: DeletedRecord) {
    try {
      await apiClient.post(`${activeModule.apiBase}/${record._id}/restore`)
      toast.success(`${activeModule.getLabel(record)} restored`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not restore record"))
    } finally {
      setPendingRestore(null)
    }
  }

  async function handlePurge(record: DeletedRecord) {
    try {
      await apiClient.delete(`${activeModule.apiBase}/${record._id}/purge`)
      toast.success(`${activeModule.getLabel(record)} permanently deleted`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not permanently delete record"))
    } finally {
      setPendingPurge(null)
    }
  }

  const columns: ColumnDef<DeletedRecord, unknown>[] = [
    {
      id: "label",
      header: "Name",
      cell: ({ row }) => (
        <div className="flex flex-col">
          <span className="font-medium">{activeModule.getLabel(row.original)}</span>
          {activeModule.getSubtitle && (
            <span className="text-xs text-muted-foreground">{activeModule.getSubtitle(row.original)}</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: "deletedAt",
      header: "Deleted On",
      cell: ({ row }) => (row.original.deletedAt ? new Date(row.original.deletedAt).toLocaleString() : "-"),
    },
    {
      id: "daysRemaining",
      header: "Restore Window",
      cell: ({ row }) => {
        const days = row.original.daysRemaining
        if (days === null || days === undefined) return "-"
        return (
          <Badge variant={days <= 7 ? "destructive" : "outline"}>
            {days} day{days === 1 ? "" : "s"} remaining
          </Badge>
        )
      },
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={() => setPendingRestore(row.original)}>
            Restore
          </Button>
          {activeModule.canPurge && (
            <Button variant="destructive" size="sm" onClick={() => setPendingPurge(row.original)}>
              Delete Permanently
            </Button>
          )}
        </div>
      ),
    },
  ]

  if (authLoading) return null
  if (!user?.isAdmin) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recycle Bin</h1>
        <p className="text-sm text-muted-foreground">
          Deleted records are restorable for 30 days, after which they&apos;re permanently and automatically removed.
        </p>
      </div>

      <Select value={moduleKey} onValueChange={(v) => v && handleModuleChange(v)}>
        <SelectTrigger className="w-56">
          <SelectValue placeholder="Select a module" />
        </SelectTrigger>
        <SelectContent>
          {MODULES.map((m) => (
            <SelectItem key={m.key} value={m.key}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        isLoading={loading}
        emptyMessage={`No deleted ${activeModule.label.toLowerCase()}.`}
      />
      {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}

      {pendingRestore && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingRestore(null)}
          title={`Restore "${activeModule.getLabel(pendingRestore)}"?`}
          description="This record will be moved back to its normal list."
          confirmLabel="Restore"
          onConfirm={() => handleRestore(pendingRestore)}
        />
      )}

      {pendingPurge && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingPurge(null)}
          title={`Permanently delete "${activeModule.getLabel(pendingPurge)}"?`}
          description="This cannot be undone - the record will be gone for good."
          confirmLabel="Delete Permanently"
          destructive
          onConfirm={() => handlePurge(pendingPurge)}
        />
      )}
    </div>
  )
}
