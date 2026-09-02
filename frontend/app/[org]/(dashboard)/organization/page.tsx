"use client"

import * as React from "react"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  Boxes,
  CheckCircle2,
  IndianRupee,
  KeyRound,
  ShieldCheck,
  UserCheck,
  Users,
  Wrench,
  XCircle,
  AlertTriangle,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/common/confirm-dialog"
import { KpiCard } from "@/components/dashboard/kpi-card"
import { RevealGroup, RevealItem } from "@/components/dashboard/reveal"
import { apiClient, apiErrorMessage, type ApiEnvelope } from "@/lib/api-client"
import { useAuth } from "@/lib/auth-context"
import { MODULE_LABELS, type EntitlementModule } from "@/lib/permissions"

type SubscriptionState = "Active" | "ExpiringSoon" | "GracePeriod" | "Suspended"

type OrganizationDetails = {
  organization: {
    _id: string
    name: string
    slug: string
    code: string | null
    email: string
    phone: string
    addressLine1: string
    addressLine2: string
    city: string
    state: string
    country: string
    postalCode: string
    status: "Active" | "Inactive"
    enabledModules: EntitlementModule[]
    validFrom: string | null
    validUntil: string | null
    gracePeriodDays: number
    recycleBinRetentionDays: number
    createdDate: string
    updatedDate: string
  }
  subscriptionState: SubscriptionState
  admin: { name: string; email: string } | null
  users: { total: number; active: number }
  assets: { total: number; assigned: number; available: number; underRepair: number }
  licenses: { total: number; active: number; expiringSoon: number; expired: number }
}

const SUBSCRIPTION_LABELS: Record<SubscriptionState, string> = {
  Active: "Active",
  ExpiringSoon: "Expiring Soon",
  GracePeriod: "Grace Period",
  Suspended: "Suspended",
}

function tabClass(active: boolean) {
  return active
    ? "shrink-0 rounded-md bg-background px-3 py-1.5 text-sm font-medium text-foreground shadow-soft-sm"
    : "shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-all hover:text-foreground"
}

export default function OrganizationDetailsPage() {
  const params = useParams<{ org: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const [data, setData] = React.useState<OrganizationDetails | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [suspendOpen, setSuspendOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)

  const load = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiClient.get<ApiEnvelope<OrganizationDetails>>(`/organizations/${params.org}`)
      setData(res.data.data)
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not load organization"))
    } finally {
      setLoading(false)
    }
  }, [params.org])

  React.useEffect(() => {
    if (user?.role === "superAdmin") load()
  }, [user, load])

  async function handleSuspendToggle() {
    if (!data) return
    const nextStatus = data.organization.status === "Active" ? "Inactive" : "Active"
    try {
      await apiClient.patch(`/organizations/${params.org}/status`, { status: nextStatus })
      toast.success(nextStatus === "Active" ? "Organization reactivated" : "Organization suspended")
      load()
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not update organization status"))
    } finally {
      setSuspendOpen(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await apiClient.delete(`/organizations/${params.org}`)
      toast.success("Organization deleted")
      router.push("/")
    } catch (err) {
      toast.error(apiErrorMessage(err, "Could not delete organization"))
      setDeleting(false)
      setDeleteOpen(false)
    }
  }

  const tabs = [
    { label: "Overview", active: true },
    { label: "Users", href: "/users" },
    { label: "Admins", href: "/users?role=orgAdmin" },
    { label: "Vendors", href: "/vendors" },
    { label: "Custom Fields", href: "/custom-fields" },
    { label: "Departments", href: "/departments" },
    { label: "Locations", href: "/locations" },
    { label: "Reports", href: "/reports" },
    { label: "Audit Logs", href: "/administration/audit-logs" },
    { label: "Settings", href: "/administration/settings" },
  ] as const

  if (user?.role !== "superAdmin") {
    return <p className="text-sm text-muted-foreground">You do not have permission to view this page.</p>
  }

  if (loading || !data) return null

  const { organization: org } = data

  return (
    <div className="flex flex-col gap-6">
      <div className="text-sm text-muted-foreground">
        <a href="/" className="hover:underline" onClick={(e) => { e.preventDefault(); router.push("/") }}>
          Organizations
        </a>{" "}
        / {org.name} / Organization Details
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{org.name}</h1>
          <p className="text-sm text-muted-foreground">Organization overview and management.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={org.status === "Active" ? "default" : "outline"}>{org.status}</Badge>
          <Badge variant={data.subscriptionState === "Active" ? "default" : "outline"}>
            {SUBSCRIPTION_LABELS[data.subscriptionState]}
          </Badge>
        </div>
      </div>

      <div className="flex w-full gap-1 overflow-x-auto rounded-lg bg-muted p-1">
        {tabs.map((tab) =>
          "href" in tab ? (
            <button
              key={tab.label}
              className={tabClass(false)}
              onClick={() => router.push(`/${params.org}${tab.href}`)}
            >
              {tab.label}
            </button>
          ) : (
            <span key={tab.label} className={tabClass(true)}>
              {tab.label}
            </span>
          )
        )}
      </div>

      <Card>
        <CardContent className="grid grid-cols-1 gap-4 pt-6 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <div className="text-xs text-muted-foreground">Organization Name</div>
            <div className="text-sm font-medium">{org.name}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Organization Code</div>
            <div className="text-sm font-medium">{org.code ?? "-"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Organization ID</div>
            <div className="text-sm font-medium">{org._id}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Organization Email</div>
            <div className="text-sm font-medium">{org.email || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Contact Number</div>
            <div className="text-sm font-medium">{org.phone || "-"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Address</div>
            <div className="text-sm font-medium">
              {[org.addressLine1, org.addressLine2, org.city, org.state, org.country, org.postalCode]
                .filter(Boolean)
                .join(", ") || "-"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Created Date</div>
            <div className="text-sm font-medium">{new Date(org.createdDate).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Last Updated</div>
            <div className="text-sm font-medium">{new Date(org.updatedDate).toLocaleDateString()}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Organization Admin</div>
            <div className="text-sm font-medium">{data.admin?.name ?? "-"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Admin Email</div>
            <div className="text-sm font-medium">{data.admin?.email ?? "-"}</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Valid From</div>
            <div className="text-sm font-medium">
              {org.validFrom ? new Date(org.validFrom).toLocaleDateString() : "-"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Valid Until</div>
            <div className="text-sm font-medium">
              {org.validUntil ? new Date(org.validUntil).toLocaleDateString() : "No expiry"}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Grace Period</div>
            <div className="text-sm font-medium">{org.gracePeriodDays} day(s)</div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground">Recycle Bin Retention</div>
            <div className="text-sm font-medium">{org.recycleBinRetentionDays} day(s)</div>
          </div>
          <div className="md:col-span-2 lg:col-span-3">
            <div className="text-xs text-muted-foreground">Enabled Modules</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {org.enabledModules.length === 0 ? (
                <span className="text-sm text-muted-foreground">None</span>
              ) : (
                org.enabledModules.map((moduleKey) => (
                  <Badge key={moduleKey} variant="outline">
                    {MODULE_LABELS[moduleKey]}
                  </Badge>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <RevealGroup className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <RevealItem><KpiCard label="Total users" value={data.users.total} icon={Users} /></RevealItem>
        <RevealItem><KpiCard label="Active users" value={data.users.active} icon={UserCheck} bucket="info" /></RevealItem>
        <RevealItem><KpiCard label="Total assets" value={data.assets.total} icon={Boxes} /></RevealItem>
        <RevealItem><KpiCard label="Assigned assets" value={data.assets.assigned} icon={CheckCircle2} bucket="info" /></RevealItem>
        <RevealItem><KpiCard label="Available assets" value={data.assets.available} icon={IndianRupee} bucket="good" /></RevealItem>
        <RevealItem><KpiCard label="Under repair" value={data.assets.underRepair} icon={Wrench} bucket="warning" /></RevealItem>
        <RevealItem><KpiCard label="Total licenses" value={data.licenses.total} icon={KeyRound} /></RevealItem>
        <RevealItem><KpiCard label="Active licenses" value={data.licenses.active} icon={ShieldCheck} bucket="good" /></RevealItem>
        <RevealItem><KpiCard label="Expiring licenses" value={data.licenses.expiringSoon} icon={AlertTriangle} bucket="warning" /></RevealItem>
        <RevealItem><KpiCard label="Expired licenses" value={data.licenses.expired} icon={XCircle} bucket="critical" /></RevealItem>
      </RevealGroup>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => router.push(`/${params.org}/organization/edit`)}>
          Edit Organization
        </Button>
        <Button variant="outline" onClick={() => router.push(`/${params.org}/users?role=orgAdmin`)}>
          Manage Admins
        </Button>
        <Button variant="outline" onClick={() => router.push(`/${params.org}/users`)}>
          Manage Users
        </Button>
        <Button variant="outline" onClick={() => router.push(`/${params.org}/users`)}>
          Manage Permissions
        </Button>
        <Button variant="outline" disabled>
          Export Organization Data
          <span className="ml-1.5 rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            Soon
          </span>
        </Button>
        <Button variant={org.status === "Active" ? "destructive" : "default"} onClick={() => setSuspendOpen(true)}>
          {org.status === "Active" ? "Suspend Organization" : "Reactivate Organization"}
        </Button>
        <Button variant="destructive" onClick={() => setDeleteOpen(true)}>
          Delete Organization
        </Button>
      </div>

      <ConfirmDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title={org.status === "Active" ? `Suspend ${org.name}?` : `Reactivate ${org.name}?`}
        description={
          org.status === "Active"
            ? "Its Org Admin and Team Members will be unable to log in until reactivated. You will still be able to view and manage this organization."
            : "Its users will be able to log in again."
        }
        confirmLabel={org.status === "Active" ? "Suspend" : "Reactivate"}
        destructive={org.status === "Active"}
        onConfirm={handleSuspendToggle}
      />

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={(open) => !deleting && setDeleteOpen(open)}
        title={`Delete ${org.name}?`}
        description={
          "This moves the organization to the Super Admin Recycle Bin - every user, asset, license, ticket, and task " +
          "belonging to it is hidden and its users can no longer log in. It can be restored at any time within 90 " +
          "days; after that it and all of its data are automatically and permanently deleted, with no way to recover it."
        }
        confirmLabel={deleting ? "Deleting..." : "Delete Organization"}
        destructive
        onConfirm={handleDelete}
      />
    </div>
  )
}
