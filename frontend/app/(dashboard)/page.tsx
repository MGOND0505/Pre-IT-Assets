import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">IT Asset &amp; License Dashboard</h1>
        <p className="text-sm text-muted-foreground">
          Combined KPI overview — built out in Phase 11 once Assets and Licenses exist.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Scaffolding complete</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          This is a placeholder. Auth, Users, and the rest of the navigation will be wired up in
          the phases that follow.
        </CardContent>
      </Card>
    </div>
  )
}
