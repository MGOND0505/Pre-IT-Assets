import { User } from "../../models/User";
import { tokenSearchFilter } from "../../utils/smartSearch";

type ListUsersAcrossOrgsInput = {
  page?: number;
  limit?: number;
  search?: string;
  status?: "Active" | "Inactive";
  // Narrows to one specific organization - the Global Users page's own org-filter Select.
  organizationId?: string;
};

/** The Super Admin panel's flat, cross-organization user directory (Phase 8) - unlike
 * users.service.ts#listUsers (scoped to a single organization via resolveOrganization), this
 * deliberately queries across every organization at once. Excludes superAdmin/subSuperAdmin
 * accounts (their `organization` is always null - see models/User.ts) since those two roles are
 * already managed on the separate Sub-Super Admins panel, not this one. Read-only - no
 * create/update/delete here, see globalUsers.routes.ts's doc comment. */
export async function listUsersAcrossOrgs(input: ListUsersAcrossOrgsInput) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = { organization: { $ne: null }, isDeleted: false };
  if (input.status) filter.status = input.status;
  // A specific org id is itself always non-null, so this simply narrows (never widens) the
  // organization-not-null filter above.
  if (input.organizationId) filter.organization = input.organizationId;
  if (input.search) filter.$or = [tokenSearchFilter(["name", "email", "employeeId"], input.search)];

  const [items, total] = await Promise.all([
    User.find(filter)
      // The one thing that makes this list cross-org-meaningful - every other populate here
      // mirrors users.service.ts#listUsers.
      .populate("organization", "name slug")
      .populate("department", "name")
      .sort({ createdDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}
