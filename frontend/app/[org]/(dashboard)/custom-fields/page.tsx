"use client"

import * as React from "react"
import { type ColumnDef } from "@tanstack/react-table"
import { MoreHorizontal } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/common/data-table"
import { Pagination } from "@/components/common/pagination"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import {
  CustomFieldDefinitionFormDialog,
  type CustomFieldDefinition,
} from "@/components/custom-fields/custom-field-definition-form-dialog"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { can, canConfigureAssetStructure } from "@/lib/permissions"
import { useAssetCategoryOptions, type CustomFieldModule, type CustomFieldType } from "@/lib/use-lookup-options"

type Paginated = { items: CustomFieldDefinition[]; total: number; page: number; totalPages: number }

const MODULES: { value: CustomFieldModule; label: string }[] = [
  { value: "assets", label: "Assets" },
  { value: "licenses", label: "Licenses" },
  { value: "helpdesk", label: "Helpdesk" },
  { value: "vendors", label: "Vendors" },
]

// Mirrors the backend's RESTRICTED_CUSTOM_FIELD_MODULES (customFieldDefinitions.service.ts) -
// Helpdesk is deliberately excluded, keeps today's normal isAdmin/Team-Member-grant behavior.
const RESTRICTED_MODULES: CustomFieldModule[] = ["assets", "licenses", "vendors"]

const TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  select: "Dropdown",
  checkbox: "Checkbox",
}

export default function CustomFieldsPage() {
  const { user, loading: authLoading } = useAuth()
  const { items: categories } = useAssetCategoryOptions()
  const categoryNameById = React.useMemo(() => new Map(categories.map((c) => [c._id, c.name])), [categories])
  const [module, setModule] = React.useState<CustomFieldModule>("assets")
  const [data, setData] = React.useState<Paginated | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [page, setPage] = React.useState(1)
  const [editing, setEditing] = React.useState<CustomFieldDefinition | null>(null)
  const [pendingDelete, setPendingDelete] = React.useState<CustomFieldDefinition | null>(null)

  const canView = can(user, "customFields", "view")
  // Assets/Licenses/Vendors are restricted to Super Admin/Sub-Super Admin - Helpdesk custom
  // fields keep the normal isAdmin/Team-Member-grant behavior, matching the backend's own
  // per-module check in customFieldDefinitions.service.ts#assertCanConfigureIfRestrictedModule.
  const isRestricted = RESTRICTED_MODULES.includes(module)
  const canCreate = isRestricted ? canConfigureAssetStructure(user, "customFields", "create") : can(user, "customFields", "create")
  const canWrite = isRestricted ? canConfigureAssetStructure(user, "customFields", "update") : can(user, "customFields", "update")
  const canDelete = isRestricted ? canConfigureAssetStructure(user, "customFields", "delete") : can(user, "customFields", "delete")

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<Paginated>>("/custom-field-definitions", {
        params: { page, limit: 10, module },
      })
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load custom fields"))
    } finally {
      setLoading(false)
    }
  }, [page, module])

  React.useEffect(() => {
    if (canView) load()
  }, [canView, load])

  React.useEffect(() => {
    setPage(1)
  }, [module])

  async function handleDelete(definition: CustomFieldDefinition) {
    try {
      await apiClient.delete(`/custom-field-definitions/${definition._id}`)
      toast.success(`${definition.label} deleted`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete custom field"))
    } finally {
      setPendingDelete(null)
    }
  }

  async function toggleStatus(definition: CustomFieldDefinition) {
    const nextStatus = definition.status === "Active" ? "Inactive" : "Active"
    try {
      await apiClient.put(`/custom-field-definitions/${definition._id}`, { status: nextStatus })
      toast.success(`${definition.label} marked ${nextStatus}`)
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update custom field"))
    }
  }

  const columns: ColumnDef<CustomFieldDefinition, unknown>[] = [
    {
      accessorKey: "label",
      header: "Label",
      cell: ({ row }) => (
        <span title={row.original.label} className="block min-w-[110px] max-w-[220px] whitespace-normal break-words">
          {row.original.label}
        </span>
      ),
    },
    {
      accessorKey: "key",
      header: "Key",
      cell: ({ row }) => <span className="font-mono text-xs text-muted-foreground">{row.original.key}</span>,
    },
    ...(module === "assets"
      ? [
          {
            id: "assetType",
            header: "Asset Type",
            cell: ({ row }: { row: { original: CustomFieldDefinition } }) =>
              row.original.category ? (categoryNameById.get(row.original.category) ?? "-") : "All asset types",
          } as ColumnDef<CustomFieldDefinition, unknown>,
        ]
      : []),
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ row }) => TYPE_LABELS[row.original.type],
    },
    {
      accessorKey: "required",
      header: "Required",
      cell: ({ row }) => (row.original.required ? "Yes" : "No"),
    },
    {
      accessorKey: "order",
      header: "Order",
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => (
        <Badge variant={row.original.status === "Active" ? "default" : "secondary"}>{row.original.status}</Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      cell: ({ row }) => (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" aria-label="Row actions">
                <MoreHorizontal className="size-4" />
              </Button>
            }
          />
          <DropdownMenuContent align="end">
            {canWrite && <DropdownMenuItem onClick={() => setEditing(row.original)}>Edit</DropdownMenuItem>}
            {canWrite && (
              <DropdownMenuItem onClick={() => toggleStatus(row.original)}>
                {row.original.status === "Active" ? "Mark Inactive" : "Mark Active"}
              </DropdownMenuItem>
            )}
            {canDelete && (
              <DropdownMenuItem variant="destructive" onClick={() => setPendingDelete(row.original)}>
                Delete
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ]

  if (authLoading) return null
  if (!canView) {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Custom Fields</h1>
          <p className="text-sm text-muted-foreground">
            Define extra fields to capture on Assets, Licenses, and Helpdesk tickets.
          </p>
        </div>
        {canCreate && <CustomFieldDefinitionFormDialog module={module} onSaved={load} />}
      </div>

      <Tabs value={module} onValueChange={(v) => setModule((v as CustomFieldModule) ?? "assets")}>
        <TabsList>
          {MODULES.map((m) => (
            <TabsTrigger key={m.value} value={m.value}>
              {m.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {MODULES.map((m) => (
          <TabsContent key={m.value} value={m.value}>
            <DataTable
              columns={columns}
              data={data?.items ?? []}
              isLoading={loading}
              emptyMessage={`No custom fields defined for ${m.label} yet.`}
            />
            {data && <Pagination page={data.page} totalPages={data.totalPages} onPageChange={setPage} />}
          </TabsContent>
        ))}
      </Tabs>

      {editing && (
        <CustomFieldDefinitionFormDialog
          module={editing.module}
          definition={editing}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          onSaved={() => {
            load()
            setEditing(null)
          }}
        />
      )}

      {pendingDelete && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setPendingDelete(null)}
          title={`Delete "${pendingDelete.label}"?`}
          description="This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={() => handleDelete(pendingDelete)}
        />
      )}
    </div>
  )
}
