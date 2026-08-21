import { Role } from "../../models/Role";
import { Permission } from "../../models/Permission";
import { User } from "../../models/User";
import { ApiError } from "../../utils/ApiError";
import { assertNoPrivilegeEscalation } from "../../utils/privilegeGuard";

async function permissionIdsForKeys(keys: string[]) {
  if (keys.length === 0) return [];
  const permissions = await Permission.find({ key: { $in: keys } }).select("_id key");

  const missing = keys.filter((key) => !permissions.some((p) => p.key === key));
  if (missing.length > 0) {
    throw new ApiError(400, `Unknown permission key(s): ${missing.join(", ")}`);
  }

  return permissions.map((p) => p.id);
}

export async function listRoles() {
  const roles = await Role.find().populate("permissions").sort({ createdDate: 1 });

  const counts = await User.aggregate<{ _id: string; count: number }>([
    { $unwind: "$roles" },
    { $group: { _id: "$roles", count: { $sum: 1 } } },
  ]);
  const countByRoleId = new Map(counts.map((c) => [String(c._id), c.count]));

  return roles.map((role) => ({
    ...role.toObject(),
    userCount: countByRoleId.get(role.id) ?? 0,
  }));
}

export async function getRoleById(id: string) {
  const role = await Role.findById(id).populate("permissions");
  if (!role) throw new ApiError(404, "Role not found");
  return role;
}

export async function createRole(input: {
  name: string;
  description: string;
  permissionKeys: string[];
  actorPermissions: string[];
  actorIsSuperAdmin: boolean;
}) {
  const existing = await Role.findOne({ name: input.name });
  if (existing) throw new ApiError(409, "A role with this name already exists");

  assertNoPrivilegeEscalation(input.actorPermissions, input.actorIsSuperAdmin, input.permissionKeys);
  const permissionIds = await permissionIdsForKeys(input.permissionKeys);

  return Role.create({
    name: input.name,
    description: input.description,
    isSystem: false,
    isSuperAdmin: false,
    permissions: permissionIds,
  });
}

export async function updateRole(
  id: string,
  input: { name?: string; description?: string; permissionKeys?: string[] },
  actorPermissions: string[],
  actorIsSuperAdmin: boolean
) {
  const role = await Role.findById(id);
  if (!role) throw new ApiError(404, "Role not found");

  if (input.name !== undefined) role.name = input.name;
  if (input.description !== undefined) role.description = input.description;

  if (input.permissionKeys !== undefined) {
    assertNoPrivilegeEscalation(actorPermissions, actorIsSuperAdmin, input.permissionKeys);
    role.permissions = await permissionIdsForKeys(input.permissionKeys);
  }

  await role.save();
  return role.populate("permissions");
}

export async function deleteRole(id: string) {
  const role = await Role.findById(id);
  if (!role) throw new ApiError(404, "Role not found");

  if (role.isSystem) {
    throw new ApiError(400, "Built-in roles cannot be deleted");
  }

  const assignedCount = await User.countDocuments({ roles: role.id });
  if (assignedCount > 0) {
    throw new ApiError(409, `This role is still assigned to ${assignedCount} user(s); reassign them first`);
  }

  await role.deleteOne();
  return role;
}

export async function listUsersByRole(id: string) {
  const role = await Role.findById(id);
  if (!role) throw new ApiError(404, "Role not found");

  return User.find({ roles: id }).select("name email status");
}
