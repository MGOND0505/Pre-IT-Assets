import bcrypt from "bcryptjs";
import { User } from "../../models/User";
import { Role } from "../../models/Role";
import { Notification } from "../../models/Notification";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { assertNoPrivilegeEscalation } from "../../utils/privilegeGuard";

async function resolveRoles(roleIds: string[]) {
  const roles = await Role.find({ _id: { $in: roleIds } }).populate("permissions");

  const missing = roleIds.filter((id) => !roles.some((r) => r.id === id));
  if (missing.length > 0) {
    throw new ApiError(400, `Unknown role id(s): ${missing.join(", ")}`);
  }

  return roles;
}

function permissionKeysOfRoles(roles: Awaited<ReturnType<typeof resolveRoles>>) {
  if (roles.some((r) => r.isSuperAdmin)) return ["*"];
  const keys = new Set<string>();
  for (const role of roles) {
    for (const permission of role.permissions as unknown as Array<{ key: string }>) keys.add(permission.key);
  }
  return Array.from(keys);
}

type CreateUserInput = {
  name: string;
  email: string;
  roleIds: string[];
  password: string;
  designation?: string;
  phone?: string;
  createdBy: string;
  actorPermissions: string[];
  actorIsSuperAdmin: boolean;
};

export async function createUser(input: CreateUserInput) {
  const existing = await User.findOne({ email: input.email.toLowerCase().trim() });
  if (existing) {
    throw new ApiError(409, "A user with this email already exists");
  }

  const roles = await resolveRoles(input.roleIds);
  assertNoPrivilegeEscalation(input.actorPermissions, input.actorIsSuperAdmin, permissionKeysOfRoles(roles));

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

  return User.create({
    name: input.name,
    email: input.email,
    roles: input.roleIds,
    passwordHash,
    designation: input.designation,
    phone: input.phone,
    createdBy: input.createdBy,
    mustChangePassword: true,
  });
}

type ListUsersInput = {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  status?: "Active" | "Inactive";
};

export async function listUsers(input: ListUsersInput) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = {};
  if (input.role) filter.roles = input.role;
  if (input.status) filter.status = input.status;
  if (input.search) {
    filter.$or = [
      { name: { $regex: input.search, $options: "i" } },
      { email: { $regex: input.search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .populate("roles", "name")
      .sort({ createdDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getUserById(id: string) {
  const user = await User.findById(id).populate("roles", "name");
  if (!user) throw new ApiError(404, "User not found");
  return user;
}

type UpdateUserInput = Partial<{ name: string; designation: string; phone: string }>;

export async function updateUser(id: string, input: UpdateUserInput) {
  const user = await getUserById(id);
  Object.assign(user, input);
  await user.save();
  return user;
}

export async function updateUserRoles(
  id: string,
  roleIds: string[],
  actorPermissions: string[],
  actorIsSuperAdmin: boolean
) {
  const roles = await resolveRoles(roleIds);
  assertNoPrivilegeEscalation(actorPermissions, actorIsSuperAdmin, permissionKeysOfRoles(roles));

  const user = await getUserById(id);
  user.roles = roleIds as never;
  user.tokenVersion += 1; // role change takes effect immediately, everywhere
  await user.save();
  return user;
}

export async function setUserStatus(id: string, status: "Active" | "Inactive") {
  const user = await getUserById(id);
  user.status = status;
  user.tokenVersion += 1; // invalidate any existing sessions immediately
  await user.save();
  return user;
}

export async function adminResetPassword(id: string, newPassword: string) {
  const user = await getUserById(id);
  user.passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
  user.mustChangePassword = true;
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.tokenVersion += 1;
  await user.save();
  return user;
}

export async function deleteUser(id: string, actingUserId: string) {
  if (id === actingUserId) {
    throw new ApiError(400, "You cannot delete your own account");
  }

  const user = await getUserById(id);

  const superAdminRole = await Role.findOne({ isSuperAdmin: true });
  const targetHoldsSuperAdmin =
    superAdminRole && user.roles.some((r) => (r as unknown as { id: string }).id === superAdminRole.id);

  if (targetHoldsSuperAdmin && superAdminRole) {
    const otherHolders = await User.countDocuments({ _id: { $ne: id }, roles: superAdminRole.id });
    if (otherHolders === 0) {
      throw new ApiError(409, "Cannot delete the last remaining Super Admin");
    }
  }

  const snapshot = { name: user.name, email: user.email, roles: user.roles };
  await user.deleteOne();
  await Notification.deleteMany({ recipient: id });

  return snapshot;
}
