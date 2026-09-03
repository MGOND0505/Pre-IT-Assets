import { Organization, type IOrganization } from "../../models/Organization";
import { User } from "../../models/User";
import { Asset } from "../../models/Asset";
import { License } from "../../models/License";
import { Ticket } from "../../models/Ticket";
import { AuditLog } from "../../models/AuditLog";
import { LoginHistory } from "../../models/LoginHistory";
import { AccessRequest } from "../../models/AccessRequest";
import { ApiError } from "../../utils/ApiError";
import { escapeRegex } from "../../utils/regex";
import { getAssetStats } from "../assets/assets.service";
import { getLicenseStats } from "../licenses/licenses.service";
import { createUser } from "../users/users.service";
import { ensureDefaultsForOrg } from "../../scripts/seedMasterDataDefaults";
import { ENTITLEMENT_MODULES, type EntitlementModule } from "../../config/permissions";

export type SubscriptionState = "Active" | "ExpiringSoon" | "GracePeriod" | "Suspended";

const EXPIRING_SOON_WINDOW_DAYS = 7;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** How long a deleted organization stays restorable before the nightly sweep
 * (recycleBinScheduler.ts) permanently purges it and all its data. */
export const ORG_RECYCLE_BIN_RETENTION_DAYS = 90;

/** Always computed from `deletedAt`, never a separately-stored field - same reasoning as
 * `getSubscriptionState`: zero staleness window, and it stays correct even if the retention
 * period constant above is ever changed. */
export function getOrganizationRestoreDeadline(org: Pick<IOrganization, "deletedAt">): Date | null {
  if (!org.deletedAt) return null;
  return new Date(org.deletedAt.getTime() + ORG_RECYCLE_BIN_RETENTION_DAYS * DAY_MS);
}

/** Whole days left to restore before the automatic purge, clamped to >= 0. Null for a
 * non-deleted organization (the field is meaningless there). */
export function getOrganizationDaysRemaining(org: Pick<IOrganization, "deletedAt">, now = new Date()): number | null {
  const deadline = getOrganizationRestoreDeadline(org);
  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS));
}

/** The single source of truth for "is this org actually usable right now" - always computed,
 * never read off a possibly-stale persisted field, so there's zero staleness window between
 * an org's validUntil passing and it actually being enforced. A manually-Inactive org (the
 * existing `status` toggle, independent of dates) is always Suspended regardless of dates. */
export function getSubscriptionState(org: Pick<IOrganization, "status" | "validUntil" | "gracePeriodDays">, now = new Date()): SubscriptionState {
  if (org.status !== "Active") return "Suspended";
  if (!org.validUntil) return "Active";

  const validUntilMs = org.validUntil.getTime();
  const nowMs = now.getTime();

  if (nowMs < validUntilMs - EXPIRING_SOON_WINDOW_DAYS * DAY_MS) return "Active";
  if (nowMs < validUntilMs) return "ExpiringSoon";
  if (nowMs < validUntilMs + org.gracePeriodDays * DAY_MS) return "GracePeriod";
  return "Suspended";
}

const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Reserved path segments a slug must never collide with - checked wherever a slug is created.
 * "organizations" is reserved because the Super Admin's own organizations list lives at that
 * flat frontend route - a future org slugged the same would be permanently shadowed by it. */
export const RESERVED_SLUGS = new Set([
  "login",
  "logout",
  "forgot-password",
  "reset-password",
  "audit-logs",
  "dashboard",
  "security-settings",
  "system-monitoring",
  "users",
  "api",
  "system",
  "admin",
  "superadmin",
  "super-admin",
  "organizations",
  "sub-super-admins",
  "my-organizations",
  "_next",
  "static",
  "favicon.ico",
]);

export async function findBySlug(slug: string) {
  return Organization.findOne({ slug: slug.toLowerCase().trim(), isDeleted: false });
}

export async function findById(id: string) {
  return Organization.findOne({ _id: id, isDeleted: false });
}

const OBJECT_ID_RE = /^[0-9a-fA-F]{24}$/;

/** Accepts either a Mongo _id or a slug - the flat Super Admin org-management endpoints are
 * addressed by :id, but the frontend's Organization Details page lives at /{orgSlug}/organization
 * and only has the slug on hand (its own Mongo id would require an extra round trip), so this
 * lets it call the same endpoint either way. */
/** Drops any enabledModules entries that aren't currently valid (e.g. `aiAssistant`, which used
 * to be a per-org entitlement and no longer is - see ENTITLEMENT_MODULES's own comment) - a
 * stale value here fails the WHOLE document's validation on save, not just that field, which
 * would otherwise permanently block every future update to that org (status, delete, retention,
 * details, module access - all of them) until manually cleaned up in the database. Only mutates
 * the in-memory array - callers that go on to org.save() persist the cleanup as a side effect;
 * read-only callers (getOrganizationDetails) just return cleaner data without an extra write. */
function sanitizeEnabledModules(org: InstanceType<typeof Organization>) {
  const valid: readonly string[] = ENTITLEMENT_MODULES;
  if (org.enabledModules.some((m) => !valid.includes(m))) {
    org.enabledModules = org.enabledModules.filter((m) => valid.includes(m)) as EntitlementModule[];
  }
  return org;
}

async function findByIdOrSlug(idOrSlug: string) {
  if (OBJECT_ID_RE.test(idOrSlug)) {
    const byId = await Organization.findOne({ _id: idOrSlug, isDeleted: false });
    if (byId) return sanitizeEnabledModules(byId);
  }
  const bySlug = await Organization.findOne({ slug: idOrSlug.toLowerCase().trim(), isDeleted: false });
  return bySlug ? sanitizeEnabledModules(bySlug) : bySlug;
}

async function primaryAdminFor(organizationId: string) {
  return User.findOne({ organization: organizationId, role: "orgAdmin", isDeleted: false })
    .sort({ createdDate: 1 })
    .select("name email");
}

type ListInput = {
  page?: number;
  limit?: number;
  search?: string;
  status?: "Active" | "Inactive";
  includeDeleted?: boolean;
};

export async function listOrganizationsWithStats(input: ListInput) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = { isDeleted: input.includeDeleted ? true : false };
  if (input.status) filter.status = input.status;
  if (input.search) {
    const search = escapeRegex(input.search);
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { code: { $regex: search, $options: "i" } },
      { slug: { $regex: search, $options: "i" } },
    ];
  }

  const [orgs, total] = await Promise.all([
    Organization.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Organization.countDocuments(filter),
  ]);

  const items = await Promise.all(
    orgs.map(async (org) => {
      const organizationId = String(org._id);
      const [userCount, assetCount, licenseCount, admin] = await Promise.all([
        User.countDocuments({ organization: organizationId, isDeleted: false }),
        Asset.countDocuments({ organization: organizationId, isDeleted: false }),
        License.countDocuments({ organization: organizationId, isDeleted: false }),
        primaryAdminFor(organizationId),
      ]);

      return {
        _id: organizationId,
        name: org.name,
        slug: org.slug,
        code: org.code,
        status: org.status,
        subscriptionState: getSubscriptionState(org),
        enabledModules: org.enabledModules,
        validFrom: org.validFrom,
        validUntil: org.validUntil,
        recycleBinRetentionDays: org.recycleBinRetentionDays,
        admin: admin ? { name: admin.name, email: admin.email } : null,
        userCount,
        assetCount,
        licenseCount,
        deletedAt: org.isDeleted ? org.deletedAt : null,
        restoreDeadline: org.isDeleted ? getOrganizationRestoreDeadline(org) : null,
        daysRemaining: org.isDeleted ? getOrganizationDaysRemaining(org) : null,
      };
    })
  );

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/** Mirrors the existing per-org dashboard's own KPI groupings (app/[org]/(dashboard)/page.tsx)
 * rather than inventing new ones - "Available" there is In Stock + Available combined,
 * "Under Repair" is that status alone (not folded together with Under Maintenance). */
function deriveAssetKpis(byStatus: Record<string, number>, total: number) {
  return {
    total,
    assigned: byStatus["Assigned"] ?? 0,
    available: (byStatus["Available"] ?? 0) + (byStatus["In Stock"] ?? 0),
    underRepair: byStatus["Under Repair"] ?? 0,
  };
}

export async function getOrganizationDetails(idOrSlug: string) {
  const org = await findByIdOrSlug(idOrSlug);
  if (!org) throw new ApiError(404, "Organization not found");

  const organizationId = String(org._id);
  const [totalUsers, activeUsers, admin, assetStats, licenseStats] = await Promise.all([
    User.countDocuments({ organization: organizationId, isDeleted: false }),
    User.countDocuments({ organization: organizationId, status: "Active", isDeleted: false }),
    primaryAdminFor(organizationId),
    getAssetStats(organizationId),
    getLicenseStats(organizationId),
  ]);

  return {
    organization: org,
    subscriptionState: getSubscriptionState(org),
    admin: admin ? { name: admin.name, email: admin.email } : null,
    users: { total: totalUsers, active: activeUsers },
    assets: deriveAssetKpis(assetStats.byStatus, assetStats.total),
    licenses: licenseStats,
  };
}

type CreateOrgInput = {
  name: string;
  slug: string;
  code?: string;
  email?: string;
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  status?: "Active" | "Inactive";
  enabledModules?: EntitlementModule[];
  validFrom?: Date;
  validUntil?: Date;
  gracePeriodDays?: number;
  recycleBinRetentionDays?: number;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
};

/** Dedupes a taken slug by appending "-2", "-3", ... rather than hard-rejecting - only for the
 * "already exists" case. A reserved-word collision (checked separately, by the caller) still
 * hard-rejects, since that's a fixed system route, not a coincidental duplicate org name. */
async function dedupeSlug(slug: string): Promise<string> {
  if (!(await findBySlug(slug))) return slug;
  for (let suffix = 2; ; suffix++) {
    const candidate = `${slug}-${suffix}`;
    if (!RESERVED_SLUGS.has(candidate) && !(await findBySlug(candidate))) return candidate;
  }
}

export async function createOrganization(input: CreateOrgInput, createdBy: string) {
  let slug = input.slug.toLowerCase().trim();

  if (!SLUG_RE.test(slug)) {
    throw new ApiError(400, "Slug must be lowercase letters, numbers, and single hyphens only");
  }
  if (RESERVED_SLUGS.has(slug)) {
    throw new ApiError(409, "That slug is reserved - please choose another");
  }
  slug = await dedupeSlug(slug);
  if (input.code) {
    const existingCode = await Organization.findOne({ code: input.code, isDeleted: false });
    if (existingCode) throw new ApiError(409, "An organization with this code already exists");
  }

  const org = await Organization.create({
    name: input.name,
    slug,
    code: input.code || null,
    email: input.email ?? "",
    phone: input.phone ?? "",
    addressLine1: input.addressLine1 ?? "",
    addressLine2: input.addressLine2 ?? "",
    city: input.city ?? "",
    state: input.state ?? "",
    country: input.country ?? "",
    postalCode: input.postalCode ?? "",
    status: input.status ?? "Active",
    enabledModules: input.enabledModules ?? [...ENTITLEMENT_MODULES],
    validFrom: input.validFrom ?? null,
    validUntil: input.validUntil ?? null,
    gracePeriodDays: input.gracePeriodDays ?? 7,
    recycleBinRetentionDays: input.recycleBinRetentionDays ?? 30,
  });

  try {
    await createUser(
      {
        name: input.adminName,
        email: input.adminEmail,
        password: input.adminPassword,
        isAdmin: true,
        createdBy,
      },
      String(org._id)
    );
  } catch (err) {
    // Roll back the org rather than leaving an admin-less "ghost" organization behind for the
    // Super Admin to notice and clean up manually - a duplicate-key race or bad password is
    // the only realistic way this fails, given the org (and therefore its users) is brand new.
    await org.deleteOne();
    throw err;
  }

  // So the new org has its default asset/license categories immediately, not only after the
  // next server restart (ensureMasterDataDefaults() otherwise only runs at startup).
  await ensureDefaultsForOrg(String(org._id));

  return org;
}

type UpdateOrgInput = Partial<
  Pick<
    IOrganization,
    | "name"
    | "code"
    | "email"
    | "phone"
    | "addressLine1"
    | "addressLine2"
    | "city"
    | "state"
    | "country"
    | "postalCode"
    | "enabledModules"
    | "validFrom"
    | "validUntil"
    | "gracePeriodDays"
    | "recycleBinRetentionDays"
  >
>;

export async function updateOrganization(idOrSlug: string, input: UpdateOrgInput) {
  const org = await findByIdOrSlug(idOrSlug);
  if (!org) throw new ApiError(404, "Organization not found");

  if (input.code && input.code !== org.code) {
    const existing = await Organization.findOne({ code: input.code, isDeleted: false, _id: { $ne: org._id } });
    if (existing) throw new ApiError(409, "An organization with this code already exists");
  }

  Object.assign(org, input);
  await org.save();
  return org;
}

/** Narrow, single-field update used by the Sub-Super Admin "my organizations" surface - deliberately
 * separate from `updateOrganization` (which is Super-Admin-only and touches every org field) so a
 * Sub-Super Admin's access to this one governance setting can never be leveraged into editing
 * anything else about an organization. */
export async function updateRecycleBinRetention(idOrSlug: string, days: number) {
  const org = await findByIdOrSlug(idOrSlug);
  if (!org) throw new ApiError(404, "Organization not found");

  org.recycleBinRetentionDays = days;
  await org.save();
  return org;
}

type UpdateOrgDetailsInput = Partial<
  Pick<
    IOrganization,
    "name" | "code" | "email" | "phone" | "addressLine1" | "addressLine2" | "city" | "state" | "country" | "postalCode"
  >
>;

/** Narrow, core-identity/contact-fields-only update used by the Sub-Super Admin "my
 * organizations" surface (see subSuperAdmins.service.ts#updateGrantedOrganizationDetails) -
 * deliberately excludes enabledModules/validFrom/validUntil/gracePeriodDays/
 * recycleBinRetentionDays, which stay Super-Admin-only governance fields reachable only through
 * the full `updateOrganization` above, same reasoning as `updateRecycleBinRetention`. */
export async function updateOrganizationDetails(idOrSlug: string, input: UpdateOrgDetailsInput) {
  const org = await findByIdOrSlug(idOrSlug);
  if (!org) throw new ApiError(404, "Organization not found");

  if (input.code && input.code !== org.code) {
    const existing = await Organization.findOne({ code: input.code, isDeleted: false, _id: { $ne: org._id } });
    if (existing) throw new ApiError(409, "An organization with this code already exists");
  }

  Object.assign(org, input);
  await org.save();
  return org;
}

export async function setOrganizationStatus(idOrSlug: string, status: "Active" | "Inactive") {
  const org = await findByIdOrSlug(idOrSlug);
  if (!org) throw new ApiError(404, "Organization not found");

  if (status === "Active" && org.validUntil) {
    const expiredPastGrace = Date.now() >= org.validUntil.getTime() + org.gracePeriodDays * DAY_MS;
    if (expiredPastGrace) {
      throw new ApiError(409, "This organization's validity period has expired. Extend the validity period before reactivating.");
    }
  }

  org.status = status;
  await org.save();
  return org;
}

export async function listDeletedOrganizations(input: ListInput) {
  return listOrganizationsWithStats({ ...input, includeDeleted: true });
}

export async function deleteOrganization(idOrSlug: string, deletedBy: string) {
  const org = await findByIdOrSlug(idOrSlug);
  if (!org) throw new ApiError(404, "Organization not found");

  org.isDeleted = true;
  org.deletedAt = new Date();
  org.deletedBy = deletedBy as unknown as IOrganization["deletedBy"];
  await org.save();
  return org;
}

export async function restoreOrganization(id: string) {
  const org = await Organization.findOne({ _id: id, isDeleted: true });
  if (!org) throw new ApiError(404, "Deleted organization not found");

  const existingSlug = await Organization.findOne({ slug: org.slug, isDeleted: false, _id: { $ne: org._id } });
  if (existingSlug) throw new ApiError(409, "An organization with this slug already exists");
  if (org.code) {
    const existingCode = await Organization.findOne({ code: org.code, isDeleted: false, _id: { $ne: org._id } });
    if (existingCode) throw new ApiError(409, "An organization with this code already exists");
  }

  org.isDeleted = false;
  org.deletedAt = null;
  org.deletedBy = null;
  await org.save();
  return org;
}

// Same "not yet responded/resolved past its due date" definition helpdesk.service.ts's
// getHelpdeskStats() already uses for one org - reused verbatim here, just without the
// organization filter, so a ticket counts as breached the same way everywhere in the app.
const DASHBOARD_TERMINAL_STATUSES = ["Resolved", "Closed"];

function lastNDays(now: Date, days: number): string[] {
  const result: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * DAY_MS);
    result.push(d.toISOString().slice(0, 10));
  }
  return result;
}

/** Real security signals this app can now honestly report (added alongside password-policy/
 * CAPTCHA/session-timeout work) - never platform-wide affected by the org filter, same reasoning
 * as the Organizations KPI itself (see SuperAdminDashboardOptions below). */
async function getSecurityAlerts(days: number) {
  const now = new Date();
  const periodAgo = new Date(now.getTime() - days * DAY_MS);

  const [lockedCount, lockedUsers, spikesRaw] = await Promise.all([
    User.countDocuments({ lockedUntil: { $gt: now }, isDeleted: false }),
    User.find({ lockedUntil: { $gt: now }, isDeleted: false })
      .select("name email organization lockedUntil")
      .populate({ path: "organization", select: "name slug" })
      .sort({ lockedUntil: 1 })
      .limit(10),
    LoginHistory.aggregate([
      { $match: { action: "login_failed", createdAt: { $gte: periodAgo }, organization: { $ne: null } } },
      {
        $group: {
          _id: "$organization",
          count: { $sum: 1 },
          captchaFailures: { $sum: { $cond: [{ $eq: ["$captchaVerified", false] }, 1, 0] } },
        },
      },
      { $match: { count: { $gte: 3 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
      { $lookup: { from: "organizations", localField: "_id", foreignField: "_id", as: "org" } },
      { $unwind: "$org" },
    ]),
  ]);

  return {
    lockedAccounts: {
      count: lockedCount,
      items: lockedUsers.map((u) => ({
        userId: u.id,
        name: u.name,
        email: u.email,
        organizationName: (u.organization as unknown as { name?: string } | null)?.name ?? null,
        organizationSlug: (u.organization as unknown as { slug?: string } | null)?.slug ?? null,
        lockedUntil: u.lockedUntil!,
      })),
    },
    failedLoginSpikes: (
      spikesRaw as { _id: unknown; count: number; captchaFailures: number; org: { name: string; slug: string } }[]
    ).map((row) => ({
      organizationId: String(row._id),
      organizationName: row.org.name,
      organizationSlug: row.org.slug,
      count: row.count,
      captchaFailures: row.captchaFailures,
    })),
  };
}

/** No unifying "pending action" concept existed anywhere in this app - this normalizes four real,
 * already-modeled but never-aggregated candidates into one list. Platform-wide like the security
 * alerts above (access requests/org subscription state/unassigned tickets are never "one org's"
 * concern for a Super Admin). */
async function getPendingActions(scope: Record<string, unknown>) {
  const [pendingAccessRequests, orgsForState, unassignedTickets] = await Promise.all([
    AccessRequest.countDocuments({ status: "Pending" }),
    Organization.find({ isDeleted: false }).select("status validUntil gracePeriodDays"),
    Ticket.countDocuments({
      ...scope,
      isDeleted: false,
      status: { $nin: DASHBOARD_TERMINAL_STATUSES },
      assignedAgent: null,
    }),
  ]);

  let expiring = 0;
  let suspended = 0;
  for (const org of orgsForState) {
    const state = getSubscriptionState(org);
    if (state === "ExpiringSoon" || state === "GracePeriod") expiring += 1;
    else if (state === "Suspended") suspended += 1;
  }

  return {
    accessRequests: { count: pendingAccessRequests },
    expiringOrganizations: { count: expiring },
    suspendedOrganizations: { count: suspended },
    unassignedTickets: { count: unassignedTickets },
  };
}

/** Cross-org role breakdown - deliberately DOES respect the org filter (unlike the two functions
 * above): scoping to one org naturally yields only orgAdmin/teamMember counts, since
 * superAdmin/subSuperAdmin always have organization: null and can never match a scoped filter -
 * the same honest behavior the existing Users/Assets KPIs already have when an org is selected. */
async function getUserRoleBreakdown(scope: Record<string, unknown>) {
  const raw = await User.aggregate([
    { $match: { ...scope, isDeleted: false } },
    { $group: { _id: "$role", count: { $sum: 1 } } },
  ]);
  return (raw as { _id: string; count: number }[]).map((r) => ({ role: r._id, count: r.count }));
}

export type SuperAdminDashboardOptions = {
  /** Trend window in days - 7/14/30 from the dashboard's date-range filter. */
  days?: number;
  /** When set, narrows Users/Assets/Tickets/activity to just this org - the platform-wide
   * "Organizations" count itself never scopes to a single org, since "how many organizations
   * does org X have" isn't a meaningful question. */
  organizationId?: string;
};

/**
 * Platform-wide, read-only counts for the Super Admin dashboard - every number here is a real
 * aggregate over existing collections (no new concepts, no invented metrics). Still deliberately
 * omits anything this app has no actual data for (storage/uptime monitoring) - security alerts
 * were added once real signals existed (LoginHistory.captchaVerified, User.lockedUntil), see
 * getSecurityAlerts above.
 */
export async function getSuperAdminDashboardStats(options: SuperAdminDashboardOptions = {}) {
  const days = options.days ?? 7;
  const now = new Date();
  const periodAgo = new Date(now.getTime() - days * DAY_MS);
  const priorPeriodAgo = new Date(now.getTime() - 2 * days * DAY_MS);

  // Applied to User/Asset/Ticket/AuditLog queries only - see SuperAdminDashboardOptions above.
  const scope: Record<string, unknown> = options.organizationId ? { organization: options.organizationId } : {};

  const [
    totalOrganizations,
    activeOrganizations,
    totalUsers,
    newUsersThisPeriod,
    totalAssets,
    newAssetsThisPeriod,
    openTickets,
    newTicketsThisPeriod,
    ticketsByStatusRaw,
    slaBreaches,
    topCategoriesRaw,
    trendRaw,
    recentActivityRaw,
    ticketsCreatedPriorPeriod,
    breachedTicketsRaw,
    topCategoryThisPeriodRaw,
    security,
    pendingActions,
    userRoles,
  ] = await Promise.all([
    Organization.countDocuments({ isDeleted: false }),
    Organization.countDocuments({ isDeleted: false, status: "Active" }),
    User.countDocuments({ ...scope, isDeleted: false, organization: scope.organization ?? { $ne: null } }),
    User.countDocuments({
      ...scope,
      isDeleted: false,
      organization: scope.organization ?? { $ne: null },
      createdDate: { $gte: periodAgo },
    }),
    Asset.countDocuments({ ...scope, isDeleted: false }),
    Asset.countDocuments({ ...scope, isDeleted: false, createdDate: { $gte: periodAgo } }),
    Ticket.countDocuments({ ...scope, isDeleted: false, status: { $nin: DASHBOARD_TERMINAL_STATUSES } }),
    Ticket.countDocuments({ ...scope, isDeleted: false, createdDate: { $gte: periodAgo } }),
    Ticket.aggregate([{ $match: { ...scope, isDeleted: false } }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Ticket.countDocuments({
      ...scope,
      isDeleted: false,
      status: { $nin: DASHBOARD_TERMINAL_STATUSES },
      slaResolutionDueAt: { $ne: null, $lt: now },
    }),
    Ticket.aggregate([
      { $match: { ...scope, isDeleted: false, category: { $ne: null } } },
      { $lookup: { from: "helpdeskcategories", localField: "category", foreignField: "_id", as: "cat" } },
      { $unwind: "$cat" },
      { $group: { _id: "$cat.name", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]),
    Ticket.aggregate([
      { $match: { ...scope, isDeleted: false, createdDate: { $gte: periodAgo } } },
      {
        $project: {
          day: { $dateToString: { format: "%Y-%m-%d", date: "$createdDate" } },
          bucket: {
            $switch: {
              branches: [
                { case: { $eq: ["$status", "Resolved"] }, then: "resolved" },
                { case: { $eq: ["$status", "Closed"] }, then: "closed" },
              ],
              default: "open",
            },
          },
        },
      },
      { $group: { _id: { day: "$day", bucket: "$bucket" }, count: { $sum: 1 } } },
    ]),
    AuditLog.find(scope)
      .sort({ createdAt: -1 })
      .limit(8)
      .populate({ path: "organization", select: "name" }),
    // The period immediately before the trailing window above - both are plain createdDate
    // range counts (no historical snapshot needed), so "volume vs last period" is a real,
    // honestly-computable comparison rather than something requiring state we don't store.
    Ticket.countDocuments({ ...scope, isDeleted: false, createdDate: { $gte: priorPeriodAgo, $lt: periodAgo } }),
    Ticket.find({
      ...scope,
      isDeleted: false,
      status: { $nin: DASHBOARD_TERMINAL_STATUSES },
      slaResolutionDueAt: { $ne: null, $lt: now },
    })
      .select("ticketId subject slaResolutionDueAt organization")
      .sort({ slaResolutionDueAt: 1 })
      .limit(5)
      .populate({ path: "organization", select: "name slug" }),
    Ticket.aggregate([
      { $match: { ...scope, isDeleted: false, category: { $ne: null }, createdDate: { $gte: periodAgo } } },
      { $lookup: { from: "helpdeskcategories", localField: "category", foreignField: "_id", as: "cat" } },
      { $unwind: "$cat" },
      { $group: { _id: "$cat.name", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]),
    getSecurityAlerts(days),
    getPendingActions(scope),
    getUserRoleBreakdown(scope),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of ticketsByStatusRaw as { _id: string | null; count: number }[]) {
    byStatus[row._id ?? "Unknown"] = row.count;
  }

  const trendByDay = new Map<string, { open: number; resolved: number; closed: number }>();
  for (const day of lastNDays(now, days)) trendByDay.set(day, { open: 0, resolved: 0, closed: 0 });
  for (const row of trendRaw as { _id: { day: string; bucket: "open" | "resolved" | "closed" }; count: number }[]) {
    const bucket = trendByDay.get(row._id.day);
    if (bucket) bucket[row._id.bucket] = row.count;
  }

  return {
    organizations: { total: totalOrganizations, active: activeOrganizations },
    users: { total: totalUsers, newInPeriod: newUsersThisPeriod },
    assets: { total: totalAssets, newInPeriod: newAssetsThisPeriod },
    tickets: {
      open: openTickets,
      newInPeriod: newTicketsThisPeriod,
      byStatus,
      slaBreaches,
      topCategories: (topCategoriesRaw as { _id: string; count: number }[]).map((r) => ({
        name: r._id,
        count: r.count,
      })),
      trend: Array.from(trendByDay.entries()).map(([date, counts]) => ({ date, ...counts })),
    },
    // Real, computed observations only - no invented "AI" narrative. Both numbers come directly
    // from createdDate range counts (this period vs the one before it), never a fabricated trend.
    insights: {
      days,
      ticketVolumeChangePct:
        ticketsCreatedPriorPeriod > 0
          ? Math.round(((newTicketsThisPeriod - ticketsCreatedPriorPeriod) / ticketsCreatedPriorPeriod) * 100)
          : null,
      ticketsInPeriod: newTicketsThisPeriod,
      ticketsInPriorPeriod: ticketsCreatedPriorPeriod,
      topCategoryInPeriod: (topCategoryThisPeriodRaw as { _id: string; count: number }[])[0]?._id ?? null,
    },
    // Only ever populated with real, currently-breached tickets - never a placeholder alert
    // type this app has no way to actually detect (no backup/disk/uptime monitoring exists).
    alerts: (
      breachedTicketsRaw as {
        _id: unknown;
        ticketId: string;
        subject: string;
        slaResolutionDueAt: Date;
        organization: { name?: string; slug?: string } | null;
      }[]
    ).map((t) => ({
      id: String(t._id),
      ticketId: t.ticketId,
      subject: t.subject,
      organizationName: t.organization?.name ?? null,
      organizationSlug: t.organization?.slug ?? null,
      slaResolutionDueAt: t.slaResolutionDueAt,
    })),
    // Shaped to match the existing ActivityEntry type the org-scoped dashboard's activity feed
    // already renders (_id/action/module/recordLabel/userSnapshot.name/createdAt) - just with an
    // added organizationName, since a cross-org feed is meaningless without saying which org.
    recentActivity: recentActivityRaw.map((log) => ({
      _id: String(log._id),
      action: log.action,
      module: log.module,
      recordLabel: log.recordLabel,
      userSnapshot: { name: log.userSnapshot.name },
      organizationName: (log.organization as unknown as { name?: string } | null)?.name ?? null,
      createdAt: log.createdAt,
    })),
    security,
    pendingActions,
    userRoles,
  };
}

export type GlobalSearchResultType = "organization" | "user" | "asset" | "ticket";
export type GlobalSearchResult = {
  type: GlobalSearchResultType;
  id: string;
  title: string;
  subtitle: string;
  // The org this result lives in - for type "organization" this is the result's own slug (so
  // the frontend can build one consistent href-building rule regardless of result type).
  organizationSlug: string | null;
  organizationName: string | null;
};

const GLOBAL_SEARCH_RESULTS_PER_TYPE = 5;

/**
 * Super Admin only, cross-organization: the platform-wide counterpart to the org-scoped
 * /search endpoint. No permission/entitlement filtering needed - a Super Admin already sees
 * every organization's data unconditionally everywhere else in the app.
 */
export async function searchAllOrganizations(rawQuery: string): Promise<GlobalSearchResult[]> {
  const rx = { $regex: escapeRegex(rawQuery), $options: "i" };

  const [orgs, users, assets, tickets] = await Promise.all([
    Organization.find({ isDeleted: false, $or: [{ name: rx }, { slug: rx }] })
      .select("name slug")
      .limit(GLOBAL_SEARCH_RESULTS_PER_TYPE)
      .lean(),
    User.find({
      isDeleted: false,
      organization: { $ne: null },
      $or: [{ name: rx }, { email: rx }, { employeeId: rx }],
    })
      .select("name email organization")
      .populate({ path: "organization", select: "name slug" })
      .limit(GLOBAL_SEARCH_RESULTS_PER_TYPE)
      .lean(),
    Asset.find({
      isDeleted: false,
      $or: [{ name: rx }, { assetId: rx }, { serialNumber: rx }],
    })
      .select("name assetId organization")
      .populate({ path: "organization", select: "name slug" })
      .limit(GLOBAL_SEARCH_RESULTS_PER_TYPE)
      .lean(),
    Ticket.find({ isDeleted: false, $or: [{ subject: rx }, { ticketId: rx }] })
      .select("subject ticketId organization")
      .populate({ path: "organization", select: "name slug" })
      .limit(GLOBAL_SEARCH_RESULTS_PER_TYPE)
      .lean(),
  ]);

  type OrgRef = { name?: string; slug?: string } | null;

  return [
    ...orgs.map((o) => ({
      type: "organization" as const,
      id: String(o._id),
      title: o.name,
      subtitle: o.slug,
      organizationSlug: o.slug,
      organizationName: o.name,
    })),
    ...users.map((u) => ({
      type: "user" as const,
      id: String(u._id),
      title: u.name,
      subtitle: u.email,
      organizationSlug: (u.organization as OrgRef)?.slug ?? null,
      organizationName: (u.organization as OrgRef)?.name ?? null,
    })),
    ...assets.map((a) => ({
      type: "asset" as const,
      id: String(a._id),
      title: a.name,
      subtitle: a.assetId,
      organizationSlug: (a.organization as OrgRef)?.slug ?? null,
      organizationName: (a.organization as OrgRef)?.name ?? null,
    })),
    ...tickets.map((t) => ({
      type: "ticket" as const,
      id: String(t._id),
      title: t.subject,
      subtitle: t.ticketId,
      organizationSlug: (t.organization as OrgRef)?.slug ?? null,
      organizationName: (t.organization as OrgRef)?.name ?? null,
    })),
  ];
}
