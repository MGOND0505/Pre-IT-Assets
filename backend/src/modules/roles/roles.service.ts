import { Role, type IRole, type RolePortalType } from "../../models/Role";
import { emptyPermissions, type PermissionsShape } from "../../config/permissions";
import { ApiError } from "../../utils/ApiError";
import { getOrgRetentionDays, withRecycleBinMeta } from "../../utils/recycleBin";
import { tokenSearchFilter } from "../../utils/smartSearch";

type ListInput = {
  page?: number;
  limit?: number;
  search?: string;
  status?: "Active" | "Inactive";
  portalType?: RolePortalType;
  includeDeleted?: boolean;
};

export async function listRoles(input: ListInput, organizationId: string) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = { organization: organizationId, isDeleted: input.includeDeleted ? true : false };
  if (input.status) filter.status = input.status;
  if (input.portalType) filter.portalType = input.portalType;
  if (input.search) Object.assign(filter, tokenSearchFilter(["name"], input.search));

  const [items, total] = await Promise.all([
    Role.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Role.countDocuments(filter),
  ]);

  const retentionDays = await getOrgRetentionDays(organizationId);
  return { items: withRecycleBinMeta(items, retentionDays), total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getRoleById(id: string, organizationId: string) {
  const role = await Role.findOne({ organization: organizationId, _id: id, isDeleted: false });
  if (!role) throw new ApiError(404, "Role not found");
  return role;
}

async function assertNameAvailable(organizationId: string, name?: string, excludeId?: string) {
  if (!name) return;
  const existing = await Role.findOne({ organization: organizationId, name, isDeleted: false, _id: { $ne: excludeId } });
  if (existing) throw new ApiError(409, "A role with this name already exists");
}

export async function createRole(
  input: { name: string; description?: string; portalType: RolePortalType; permissions?: Partial<PermissionsShape> },
  organizationId: string
) {
  await assertNameAvailable(organizationId, input.name);
  const permissions = input.permissions ? { ...emptyPermissions(), ...input.permissions } : emptyPermissions();
  return Role.create({
    organization: organizationId,
    name: input.name,
    description: input.description ?? "",
    portalType: input.portalType,
    permissions,
  });
}

export async function updateRole(
  id: string,
  input: Partial<{
    name: string;
    description: string;
    portalType: RolePortalType;
    permissions: Partial<PermissionsShape>;
    status: "Active" | "Inactive";
  }>,
  organizationId: string
) {
  const role = await getRoleById(id, organizationId);
  await assertNameAvailable(organizationId, input.name, id);

  const { permissions, ...rest } = input;
  Object.assign(role, rest);
  if (permissions) {
    role.permissions = { ...role.permissions, ...permissions } as PermissionsShape;
  }
  await role.save();
  return role;
}

/** Soft delete: hidden from normal listings but recoverable via the Recycle Bin. Users who
 * already had this Role applied keep their copied permissions untouched - see the module-level
 * doc comment on IRole - so deleting a Role is safe even for accounts currently "on" it. */
export async function deleteRole(id: string, deletedBy: string, organizationId: string) {
  const role = await getRoleById(id, organizationId);
  role.isDeleted = true;
  role.deletedAt = new Date();
  role.deletedBy = deletedBy as unknown as IRole["deletedBy"];
  await role.save();
  return role;
}

export async function restoreRole(id: string, organizationId: string) {
  const role = await Role.findOne({ organization: organizationId, _id: id, isDeleted: true });
  if (!role) throw new ApiError(404, "Deleted role not found");
  await assertNameAvailable(organizationId, role.name, id);

  role.isDeleted = false;
  role.deletedAt = null;
  role.deletedBy = null;
  await role.save();
  return role;
}
