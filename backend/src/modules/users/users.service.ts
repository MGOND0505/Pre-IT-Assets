import bcrypt from "bcryptjs";
import { User, type IUser } from "../../models/User";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { emptyPermissions, type PermissionsShape } from "../../config/permissions";
import { getOrgRetentionDays, withRecycleBinMeta } from "../../utils/recycleBin";

type CreateUserInput = {
  name: string;
  email: string;
  employeeId?: string;
  password: string;
  designation?: string;
  phone?: string;
  department?: string;
  location?: string;
  isAdmin?: boolean;
  permissions?: Partial<PermissionsShape>;
  createdBy: string;
};

export async function createUser(input: CreateUserInput, organizationId: string) {
  const existing = await User.findOne({
    organization: organizationId,
    email: input.email.toLowerCase().trim(),
    isDeleted: false,
  });
  if (existing) {
    throw new ApiError(409, "A user with this email already exists");
  }

  if (input.employeeId) {
    const existingEmployeeId = await User.findOne({
      organization: organizationId,
      employeeId: input.employeeId.toUpperCase().trim(),
      isDeleted: false,
    });
    if (existingEmployeeId) {
      throw new ApiError(409, "A user with this employee ID already exists");
    }
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

  return User.create({
    organization: organizationId,
    name: input.name,
    email: input.email,
    employeeId: input.employeeId,
    passwordHash,
    designation: input.designation,
    phone: input.phone,
    department: input.department || null,
    location: input.location || null,
    role: input.isAdmin ? "orgAdmin" : "teamMember",
    permissions: { ...emptyPermissions(), ...input.permissions },
    createdBy: input.createdBy,
    mustChangePassword: true,
  });
}

type ListUsersInput = {
  page?: number;
  limit?: number;
  search?: string;
  status?: "Active" | "Inactive";
  role?: "superAdmin" | "orgAdmin" | "teamMember";
  includeDeleted?: boolean;
};

export async function listUsers(input: ListUsersInput, organizationId: string) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = { organization: organizationId, isDeleted: input.includeDeleted ? true : false };
  if (input.status) filter.status = input.status;
  if (input.role) filter.role = input.role;
  if (input.search) {
    filter.$or = [
      { name: { $regex: input.search, $options: "i" } },
      { email: { $regex: input.search, $options: "i" } },
      { employeeId: { $regex: input.search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .populate("department", "name")
      .populate("location", "name")
      .sort({ createdDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  const retentionDays = await getOrgRetentionDays(organizationId);
  return { items: withRecycleBinMeta(items, retentionDays), total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getUserById(id: string, organizationId: string) {
  const user = await User.findOne({ _id: id, organization: organizationId, isDeleted: false })
    .populate("department", "name")
    .populate("location", "name");
  if (!user) throw new ApiError(404, "User not found");
  return user;
}

type UpdateUserInput = Partial<{
  name: string;
  employeeId: string;
  designation: string;
  phone: string;
  department: string;
  location: string;
}>;

export async function updateUser(id: string, input: UpdateUserInput, organizationId: string) {
  const user = await getUserById(id, organizationId);

  if (input.employeeId && input.employeeId.toUpperCase().trim() !== user.employeeId) {
    const existing = await User.findOne({
      organization: organizationId,
      employeeId: input.employeeId.toUpperCase().trim(),
      isDeleted: false,
    });
    if (existing) {
      throw new ApiError(409, "A user with this employee ID already exists");
    }
  }

  Object.assign(user, input);
  await user.save();
  return user;
}

export async function updateUserPermissions(
  id: string,
  input: { isAdmin?: boolean; permissions?: Partial<PermissionsShape> },
  organizationId: string
) {
  const user = await getUserById(id, organizationId);

  if (user.isAdmin && input.isAdmin === false) {
    // Scoped to this organization only - counting admins globally would let another org's
    // admin count mask (or wrongly block) a "last admin in THIS org" removal.
    const otherAdmins = await User.countDocuments({
      _id: { $ne: id },
      organization: organizationId,
      role: "orgAdmin",
      isDeleted: false,
    });
    if (otherAdmins === 0) {
      throw new ApiError(409, "Cannot remove Admin from the last remaining Admin in this organization");
    }
  }

  if (input.isAdmin !== undefined) user.role = input.isAdmin ? "orgAdmin" : "teamMember";
  if (input.permissions) {
    user.permissions = { ...user.permissions, ...input.permissions } as PermissionsShape;
  }
  user.tokenVersion += 1; // permission change takes effect immediately, everywhere
  await user.save();
  return user;
}

export async function setUserStatus(id: string, status: "Active" | "Inactive", organizationId: string) {
  const user = await getUserById(id, organizationId);
  user.status = status;
  user.tokenVersion += 1; // invalidate any existing sessions immediately
  await user.save();
  return user;
}

export async function adminResetPassword(id: string, newPassword: string, organizationId: string) {
  const user = await getUserById(id, organizationId);
  user.passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
  user.mustChangePassword = true;
  user.failedLoginAttempts = 0;
  user.lockedUntil = null;
  user.tokenVersion += 1;
  await user.save();
  return user;
}

export async function deleteUser(id: string, actingUserId: string, organizationId: string) {
  if (id === actingUserId) {
    throw new ApiError(400, "You cannot delete your own account");
  }

  const user = await getUserById(id, organizationId);

  if (user.isAdmin) {
    // Scoped to this organization only - see updateUserPermissions's identical guard above.
    const otherAdmins = await User.countDocuments({
      _id: { $ne: id },
      organization: organizationId,
      role: "orgAdmin",
      isDeleted: false,
    });
    if (otherAdmins === 0) {
      throw new ApiError(409, "Cannot delete the last remaining Admin in this organization");
    }
  }

  const snapshot = { name: user.name, email: user.email, isAdmin: user.isAdmin };

  user.isDeleted = true;
  user.deletedAt = new Date();
  user.deletedBy = actingUserId as unknown as IUser["deletedBy"];
  user.tokenVersion += 1; // invalidate any existing sessions immediately
  await user.save();

  return snapshot;
}

export async function restoreUser(id: string, organizationId: string) {
  const user = await User.findOne({ _id: id, organization: organizationId, isDeleted: true });
  if (!user) throw new ApiError(404, "Deleted user not found");

  const existingEmail = await User.findOne({ organization: organizationId, email: user.email, isDeleted: false });
  if (existingEmail) {
    throw new ApiError(409, "A user with this email already exists");
  }
  if (user.employeeId) {
    const existingEmployeeId = await User.findOne({
      organization: organizationId,
      employeeId: user.employeeId,
      isDeleted: false,
    });
    if (existingEmployeeId) {
      throw new ApiError(409, "A user with this employee ID already exists");
    }
  }

  user.isDeleted = false;
  user.deletedAt = null;
  user.deletedBy = null;
  await user.save();
  return user;
}
