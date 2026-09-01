import { Asset } from "../../models/Asset";
import { License } from "../../models/License";
import { Ticket } from "../../models/Ticket";
import { Task } from "../../models/Task";
import { Vendor } from "../../models/Vendor";
import { Department } from "../../models/Department";
import { Location } from "../../models/Location";
import { User } from "../../models/User";
import type { EntitlementModule, PermissionModule, PermissionsShape } from "../../config/permissions";
import type { UserRole } from "../../models/User";

export type SearchResultType =
  | "asset"
  | "license"
  | "ticket"
  | "task"
  | "vendor"
  | "department"
  | "location"
  | "user";

export type SearchResult = {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
};

export type SearchContext = {
  organizationId: string;
  userId: string;
  role: UserRole;
  isAdmin: boolean;
  enabledModules: EntitlementModule[];
  permissions: PermissionsShape;
};

// Caps how many rows come back per entity type - this is a quick-navigation aid, not a full
// search results page, so a handful of the best matches per type is the right shape.
const RESULTS_PER_TYPE = 5;

// User input goes straight into a Mongo $regex - escape regex metacharacters so a query like
// "a+" or "(" can't throw or turn into an unintended pattern.
function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Mirrors authorize()/requireModuleEnabled()'s exact bypass rules (superAdmin skips the
 * entitlement gate, isAdmin skips the per-action permission check) so search never surfaces a
 * result the same user would get a 403 for if they clicked into that module directly. */
function canView(ctx: SearchContext, entitlement: EntitlementModule | null, permissionModule: PermissionModule) {
  if (entitlement && ctx.role !== "superAdmin" && !ctx.enabledModules.includes(entitlement)) return false;
  return ctx.isAdmin || Boolean(ctx.permissions[permissionModule]?.view);
}

export async function searchOrganization(ctx: SearchContext, rawQuery: string): Promise<SearchResult[]> {
  const rx = { $regex: escapeRegex(rawQuery), $options: "i" };
  const lookups: Promise<SearchResult[]>[] = [];

  if (canView(ctx, "assets", "assets")) {
    // Same restriction as assets.service.ts#canViewAllAssets - a caller who can't manage assets
    // beyond their own must not find someone else's asset via search either, even just a
    // title/id result (they'd 404 clicking into it, but the leak itself is the point of the fix).
    const canViewAllAssets = ctx.isAdmin || Boolean(ctx.permissions.assets?.update);
    lookups.push(
      Asset.find({
        organization: ctx.organizationId,
        isDeleted: false,
        ...(canViewAllAssets ? {} : { assignedUser: ctx.userId }),
        $or: [{ name: rx }, { assetId: rx }, { serialNumber: rx }, { serviceTag: rx }, { imei: rx }],
      })
        .select("name assetId")
        .limit(RESULTS_PER_TYPE)
        .lean()
        .then((rows) =>
          rows.map((r) => ({ type: "asset" as const, id: String(r._id), title: r.name, subtitle: r.assetId }))
        )
    );
  }

  if (canView(ctx, "licenses", "licenses")) {
    lookups.push(
      License.find({
        organization: ctx.organizationId,
        isDeleted: false,
        $or: [{ softwareName: rx }, { productName: rx }, { publisher: rx }, { licenseId: rx }],
      })
        .select("softwareName licenseId")
        .limit(RESULTS_PER_TYPE)
        .lean()
        .then((rows) =>
          rows.map((r) => ({ type: "license" as const, id: String(r._id), title: r.softwareName, subtitle: r.licenseId }))
        )
    );
  }

  if (canView(ctx, "helpdesk", "helpdesk")) {
    lookups.push(
      Ticket.find({
        organization: ctx.organizationId,
        isDeleted: false,
        $or: [{ subject: rx }, { ticketId: rx }],
      })
        .select("subject ticketId")
        .limit(RESULTS_PER_TYPE)
        .lean()
        .then((rows) =>
          rows.map((r) => ({ type: "ticket" as const, id: String(r._id), title: r.subject, subtitle: r.ticketId }))
        )
    );
  }

  if (canView(ctx, "tasks", "tasks")) {
    lookups.push(
      Task.find({
        organization: ctx.organizationId,
        isDeleted: false,
        $or: [{ title: rx }, { taskId: rx }],
      })
        .select("title taskId")
        .limit(RESULTS_PER_TYPE)
        .lean()
        .then((rows) =>
          rows.map((r) => ({ type: "task" as const, id: String(r._id), title: r.title, subtitle: r.taskId }))
        )
    );
  }

  if (canView(ctx, "vendors", "vendors")) {
    lookups.push(
      Vendor.find({
        organization: ctx.organizationId,
        isDeleted: false,
        $or: [{ name: rx }, { contactPerson: rx }, { email: rx }],
      })
        .select("name service")
        .limit(RESULTS_PER_TYPE)
        .lean()
        .then((rows) =>
          rows.map((r) => ({ type: "vendor" as const, id: String(r._id), title: r.name, subtitle: r.service || "Vendor" }))
        )
    );
  }

  if (canView(ctx, "departments", "departments")) {
    lookups.push(
      Department.find({ organization: ctx.organizationId, isDeleted: false, name: rx })
        .select("name")
        .limit(RESULTS_PER_TYPE)
        .lean()
        .then((rows) =>
          rows.map((r) => ({ type: "department" as const, id: String(r._id), title: r.name, subtitle: "Department" }))
        )
    );
  }

  if (canView(ctx, "locations", "locations")) {
    lookups.push(
      Location.find({
        organization: ctx.organizationId,
        isDeleted: false,
        $or: [{ name: rx }, { city: rx }, { state: rx }],
      })
        .select("name city")
        .limit(RESULTS_PER_TYPE)
        .lean()
        .then((rows) =>
          rows.map((r) => ({ type: "location" as const, id: String(r._id), title: r.name, subtitle: r.city || "Location" }))
        )
    );
  }

  if (canView(ctx, null, "users")) {
    lookups.push(
      User.find({
        organization: ctx.organizationId,
        isDeleted: false,
        $or: [{ name: rx }, { email: rx }, { employeeId: rx }],
      })
        .select("name email")
        .limit(RESULTS_PER_TYPE)
        .lean()
        .then((rows) =>
          rows.map((r) => ({ type: "user" as const, id: String(r._id), title: r.name, subtitle: r.email }))
        )
    );
  }

  const results = await Promise.all(lookups);
  return results.flat();
}
