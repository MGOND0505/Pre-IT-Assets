import { Organization, type IOrganization } from "../../models/Organization";
import { User } from "../../models/User";
import { Asset } from "../../models/Asset";
import { License } from "../../models/License";
import { ApiError } from "../../utils/ApiError";
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
  "api",
  "system",
  "admin",
  "superadmin",
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
async function findByIdOrSlug(idOrSlug: string) {
  if (OBJECT_ID_RE.test(idOrSlug)) {
    const byId = await Organization.findOne({ _id: idOrSlug, isDeleted: false });
    if (byId) return byId;
  }
  return Organization.findOne({ slug: idOrSlug.toLowerCase().trim(), isDeleted: false });
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
    filter.$or = [
      { name: { $regex: input.search, $options: "i" } },
      { code: { $regex: input.search, $options: "i" } },
      { slug: { $regex: input.search, $options: "i" } },
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
