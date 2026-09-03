import bcrypt from "bcryptjs";
import { User } from "../../models/User";
import { Organization } from "../../models/Organization";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { emptyPermissions, type PermissionsShape } from "../../config/permissions";
import * as organizationsService from "../organizations/organizations.service";
import * as settingsService from "../settings/settings.service";
import { BASELINE_POLICY, validatePasswordAgainstPolicy, assertPasswordNotReused, pushPasswordHistory } from "../../utils/passwordPolicy";

type OrgAccessInput = { organization: string; permissions: Partial<PermissionsShape> }[];

function normalizeOrgAccess(input: OrgAccessInput) {
  const seen = new Set<string>();
  for (const grant of input) {
    if (seen.has(grant.organization)) {
      throw new ApiError(400, "Cannot grant the same organization more than once");
    }
    seen.add(grant.organization);
  }
  return input.map((grant) => ({
    organization: grant.organization,
    permissions: { ...emptyPermissions(), ...grant.permissions },
  }));
}

async function assertOrganizationsExist(orgIds: string[]) {
  if (orgIds.length === 0) return;
  const count = await Organization.countDocuments({ _id: { $in: orgIds }, isDeleted: false });
  if (count !== new Set(orgIds).size) {
    throw new ApiError(400, "One or more assigned organizations do not exist");
  }
}

type CreateInput = {
  name: string;
  email: string;
  password: string;
  orgAccess: OrgAccessInput;
  createdBy: string;
};

export async function createSubSuperAdmin(input: CreateInput) {
  const email = input.email.toLowerCase().trim();
  const existing = await User.findOne({ organization: null, email });
  if (existing) {
    throw new ApiError(409, "A system-level account with this email already exists");
  }

  const orgAccess = normalizeOrgAccess(input.orgAccess);
  await assertOrganizationsExist(orgAccess.map((g) => g.organization));

  const violations = validatePasswordAgainstPolicy(input.password, BASELINE_POLICY);
  if (violations.length > 0) throw new ApiError(400, violations.join(" "));

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

  return User.create({
    name: input.name,
    email,
    passwordHash,
    role: "subSuperAdmin",
    organization: null,
    orgAccess,
    createdBy: input.createdBy,
    mustChangePassword: true,
    passwordChangedAt: new Date(),
  });
}

const POPULATE_ORG_ACCESS = { path: "orgAccess.organization", select: "name slug status" };

export async function listSubSuperAdmins() {
  return User.find({ role: "subSuperAdmin" }).populate(POPULATE_ORG_ACCESS).sort({ createdDate: -1 });
}

export async function getSubSuperAdminById(id: string) {
  const user = await User.findOne({ _id: id, role: "subSuperAdmin" }).populate(POPULATE_ORG_ACCESS);
  if (!user) throw new ApiError(404, "Sub-Super Admin not found");
  return user;
}

export async function updateSubSuperAdmin(id: string, input: Partial<{ name: string; email: string }>) {
  const user = await getSubSuperAdminById(id);

  if (input.email && input.email.toLowerCase().trim() !== user.email) {
    const email = input.email.toLowerCase().trim();
    const existing = await User.findOne({ organization: null, email, _id: { $ne: id } });
    if (existing) throw new ApiError(409, "A system-level account with this email already exists");
    user.email = email;
  }
  if (input.name) user.name = input.name;

  await user.save();
  return user;
}

export async function updateSubSuperAdminAccess(id: string, orgAccess: OrgAccessInput) {
  const user = await getSubSuperAdminById(id);
  const normalized = normalizeOrgAccess(orgAccess);
  await assertOrganizationsExist(normalized.map((g) => g.organization));

  user.orgAccess = normalized as unknown as typeof user.orgAccess;
  user.tokenVersion += 1; // access change takes effect immediately, everywhere
  await user.save();
  return getSubSuperAdminById(id);
}

export async function setSubSuperAdminStatus(id: string, status: "Active" | "Inactive") {
  const user = await getSubSuperAdminById(id);
  user.status = status;
  user.tokenVersion += 1;
  await user.save();
  return user;
}

export async function resetSubSuperAdminPassword(id: string, newPassword: string) {
  const user = await User.findOne({ _id: id, role: "subSuperAdmin" }).select("+passwordHash +passwordHistory");
  if (!user) throw new ApiError(404, "Sub-Super Admin not found");

  const violations = validatePasswordAgainstPolicy(newPassword, BASELINE_POLICY);
  if (violations.length > 0) throw new ApiError(400, violations.join(" "));
  await assertPasswordNotReused(newPassword, user, BASELINE_POLICY.historyLimit);

  const oldHash = user.passwordHash;
  user.passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
  pushPasswordHistory(user, oldHash, BASELINE_POLICY.historyLimit);
  user.passwordChangedAt = new Date();
  user.mustChangePassword = true;
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.tokenVersion += 1;
  await user.save();
  return user;
}

export async function deleteSubSuperAdmin(id: string, actingUserId: string) {
  if (id === actingUserId) {
    throw new ApiError(400, "You cannot delete your own account");
  }
  const user = await getSubSuperAdminById(id);
  const snapshot = { name: user.name, email: user.email };
  await user.deleteOne();
  return snapshot;
}

/** Grants (or updates, if one already exists for this org) a single org-access entry for a
 * Sub-Super Admin - used when an access request is approved, so approval reuses the exact same
 * write path as the manual "Edit access" dialog rather than duplicating orgAccess-mutation logic. */
export async function upsertOrgAccessGrant(userId: string, organizationId: string, permissions: PermissionsShape) {
  const user = await getSubSuperAdminById(userId);
  const existing = user.orgAccess.find((g) => String(g.organization) === organizationId);
  if (existing) {
    existing.permissions = permissions;
  } else {
    user.orgAccess.push({ organization: organizationId, permissions } as unknown as (typeof user.orgAccess)[number]);
  }
  user.tokenVersion += 1;
  await user.save();
  return getSubSuperAdminById(userId);
}

/** For the Sub-Super Admin's own landing page - just the organizations THEY hold a grant for,
 * never the full system list (that stays Super-Admin-only via /api/organizations). */
export async function listMyGrantedOrganizations(userId: string) {
  const user = await User.findOne({ _id: userId, role: "subSuperAdmin" }).populate({
    path: "orgAccess.organization",
    select:
      "name slug status recycleBinRetentionDays code email phone addressLine1 addressLine2 city state country postalCode",
  });
  if (!user) return [];
  // A purged (permanently deleted) organization leaves a dangling grant behind - populate
  // resolves those to null rather than erroring, so filter them out here.
  return user.orgAccess.map((grant) => grant.organization).filter(Boolean);
}

/** Lets a Sub-Super Admin change ONLY the Recycle Bin retention period for an organization they
 * hold a grant for - checked here rather than relying on `resolveOrganization` (this endpoint is
 * mounted flat, not under `/api/:orgSlug`, since it's system-level governance like the Super
 * Admin's own organization management, not an org-scoped action). */
export async function updateGrantedOrganizationRetention(userId: string, organizationId: string, days: number) {
  const user = await User.findOne({ _id: userId, role: "subSuperAdmin" });
  if (!user) throw new ApiError(403, "Not a Sub-Super Admin");

  const hasGrant = user.orgAccess.some((grant) => String(grant.organization) === organizationId);
  if (!hasGrant) throw new ApiError(403, "You do not have access to this organization");

  return organizationsService.updateRecycleBinRetention(organizationId, days);
}

/** Lets a Sub-Super Admin edit an organization's core identity/contact details (name, code,
 * email, phone, address) for an organization they hold a grant for - mirrors
 * updateGrantedOrganizationRetention's grant check exactly. Governance fields (module access,
 * subscription validity, grace period, recycle-bin retention) stay out of reach here - retention
 * has its own separate narrow endpoint above, and the rest stay Super-Admin-only via the full
 * /api/organizations update route. */
export async function updateGrantedOrganizationDetails(
  userId: string,
  organizationId: string,
  input: Parameters<typeof organizationsService.updateOrganizationDetails>[1]
) {
  const user = await User.findOne({ _id: userId, role: "subSuperAdmin" });
  if (!user) throw new ApiError(403, "Not a Sub-Super Admin");

  const hasGrant = user.orgAccess.some((grant) => String(grant.organization) === organizationId);
  if (!hasGrant) throw new ApiError(403, "You do not have access to this organization");

  return organizationsService.updateOrganizationDetails(organizationId, input);
}

/** Lets a Sub-Super Admin upload/replace the logo for an organization they hold a grant for -
 * same "any grant qualifies" check as updateGrantedOrganizationDetails/Retention above,
 * deliberately NOT gated by that org's granular settings.update permission (unlike the org-scoped
 * /api/:orgSlug/settings/logo route a Super Admin already uses for this same purpose). */
export async function uploadGrantedOrganizationLogo(
  userId: string,
  organizationId: string,
  file: { buffer: Buffer; mimetype: string }
) {
  const user = await User.findOne({ _id: userId, role: "subSuperAdmin" });
  if (!user) throw new ApiError(403, "Not a Sub-Super Admin");

  const hasGrant = user.orgAccess.some((grant) => String(grant.organization) === organizationId);
  if (!hasGrant) throw new ApiError(403, "You do not have access to this organization");

  return settingsService.saveLogoFile(organizationId, file);
}

/** Lets a Sub-Super Admin remove the logo for an organization they hold a grant for - see
 * uploadGrantedOrganizationLogo's comment. */
export async function removeGrantedOrganizationLogo(userId: string, organizationId: string) {
  const user = await User.findOne({ _id: userId, role: "subSuperAdmin" });
  if (!user) throw new ApiError(403, "Not a Sub-Super Admin");

  const hasGrant = user.orgAccess.some((grant) => String(grant.organization) === organizationId);
  if (!hasGrant) throw new ApiError(403, "You do not have access to this organization");

  return settingsService.removeLogoFile(organizationId);
}
