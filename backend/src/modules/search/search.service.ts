import type { Model } from "mongoose";
import { Asset } from "../../models/Asset";
import { AssetCategory } from "../../models/AssetCategory";
import { License } from "../../models/License";
import { LicenseCategory } from "../../models/LicenseCategory";
import { Ticket } from "../../models/Ticket";
import { HelpdeskCategory } from "../../models/HelpdeskCategory";
import { Task } from "../../models/Task";
import { Vendor } from "../../models/Vendor";
import { Department } from "../../models/Department";
import { Location } from "../../models/Location";
import { User } from "../../models/User";
import type { EntitlementModule, PermissionModule, PermissionsShape } from "../../config/permissions";
import type { UserRole } from "../../models/User";
import { escapeRegex } from "../../utils/regex";

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

/** Mirrors authorize()/requireModuleEnabled()'s exact bypass rules (superAdmin skips the
 * entitlement gate, isAdmin skips the per-action permission check) so search never surfaces a
 * result the same user would get a 403 for if they clicked into that module directly. */
function canView(ctx: SearchContext, entitlement: EntitlementModule | null, permissionModule: PermissionModule) {
  if (entitlement && ctx.role !== "superAdmin" && !ctx.enabledModules.includes(entitlement)) return false;
  return ctx.isAdmin || Boolean(ctx.permissions[permissionModule]?.view);
}

export async function searchOrganization(ctx: SearchContext, rawQuery: string): Promise<SearchResult[]> {
  // Splits the query into whitespace-separated tokens so a multi-word phrase like "dell laptop"
  // or "john ticket" matches records where each token appears somewhere across the searched
  // fields, even if no single field contains the whole phrase - the previous single-regex-
  // against-the-whole-query behavior only ever matched a literal exact phrase, which is why a
  // natural-language-style multi-word query silently returned nothing. A single-word query has
  // exactly one token, so it behaves exactly as before.
  const tokens = rawQuery
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => ({ $regex: escapeRegex(token), $options: "i" }));

  // Every token must match SOMEWHERE across the given fields (each token itself matches ANY of
  // those fields) - an AND-of-ORs, so "dell laptop" requires both words present (in either
  // order, across either field) rather than needing one field to contain the literal phrase.
  function matchesAllTokens(fields: string[]) {
    return { $and: tokens.map((rx) => ({ $or: fields.map((field) => ({ [field]: rx })) })) };
  }

  /**
   * Same AND-of-ORs shape as matchesAllTokens, but also lets a token match via the record's
   * CATEGORY name rather than only its own fields - e.g. searching "laptop" previously only found
   * the handful of assets whose own `name` happened to literally contain the word "laptop" (an
   * inconsistent, incidental match), missing every other asset actually filed under the Laptop
   * category (490 of them in one real org's data, vs. 2 matched by name alone). Resolves each
   * token's matching category ids independently (a token is genuinely case-insensitive/partial
   * against the category's own name), then folds `category: {$in: ...}` into that token's OR.
   */
  async function matchesAllTokensOrCategory(fields: string[], categoryModel: Model<any>) {
    const categoryIdsPerToken = await Promise.all(
      tokens.map((rx) =>
        categoryModel
          .find({ organization: ctx.organizationId, name: rx })
          .select("_id")
          .lean()
          .then((rows) => rows.map((r) => r._id))
      )
    );
    return {
      $and: tokens.map((rx, i) => ({
        $or: [...fields.map((field) => ({ [field]: rx })), { category: { $in: categoryIdsPerToken[i] } }],
      })),
    };
  }

  const lookups: Promise<SearchResult[]>[] = [];

  if (canView(ctx, "assets", "assets")) {
    // Same restriction as assets.service.ts#canViewAllAssets - a caller who can't manage assets
    // beyond their own must not find someone else's asset via search either, even just a
    // title/id result (they'd 404 clicking into it, but the leak itself is the point of the fix).
    const canViewAllAssets = ctx.isAdmin || Boolean(ctx.permissions.assets?.update);
    lookups.push(
      matchesAllTokensOrCategory(["name", "assetId", "serialNumber", "serviceTag", "imei"], AssetCategory).then(
        (tokenMatch) =>
          Asset.find({
            organization: ctx.organizationId,
            isDeleted: false,
            ...(canViewAllAssets ? {} : { assignedUser: ctx.userId }),
            ...tokenMatch,
          })
            .select("name assetId")
            .limit(RESULTS_PER_TYPE)
            .lean()
            .then((rows) =>
              rows.map((r) => ({ type: "asset" as const, id: String(r._id), title: r.name, subtitle: r.assetId }))
            )
      )
    );
  }

  if (canView(ctx, "licenses", "licenses")) {
    lookups.push(
      matchesAllTokensOrCategory(["softwareName", "productName", "publisher", "licenseId"], LicenseCategory).then(
        (tokenMatch) =>
          License.find({ organization: ctx.organizationId, isDeleted: false, ...tokenMatch })
            .select("softwareName licenseId")
            .limit(RESULTS_PER_TYPE)
            .lean()
            .then((rows) =>
              rows.map((r) => ({
                type: "license" as const,
                id: String(r._id),
                title: r.softwareName,
                subtitle: r.licenseId,
              }))
            )
      )
    );
  }

  if (canView(ctx, "helpdesk", "helpdesk")) {
    lookups.push(
      matchesAllTokensOrCategory(["subject", "ticketId"], HelpdeskCategory).then((tokenMatch) =>
        Ticket.find({ organization: ctx.organizationId, isDeleted: false, ...tokenMatch })
          .select("subject ticketId")
          .limit(RESULTS_PER_TYPE)
          .lean()
          .then((rows) =>
            rows.map((r) => ({ type: "ticket" as const, id: String(r._id), title: r.subject, subtitle: r.ticketId }))
          )
      )
    );
  }

  if (canView(ctx, "tasks", "tasks")) {
    lookups.push(
      Task.find({
        organization: ctx.organizationId,
        isDeleted: false,
        ...matchesAllTokens(["title", "taskId"]),
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
        ...matchesAllTokens(["name", "contactPerson", "email"]),
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
      Department.find({ organization: ctx.organizationId, isDeleted: false, ...matchesAllTokens(["name"]) })
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
        ...matchesAllTokens(["name", "city", "state"]),
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
        ...matchesAllTokens(["name", "email", "employeeId"]),
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
