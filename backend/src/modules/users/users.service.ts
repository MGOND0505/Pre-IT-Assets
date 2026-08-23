import bcrypt from "bcryptjs";
import { User } from "../../models/User";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { emptyPermissions, type PermissionsShape } from "../../config/permissions";

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

export async function createUser(input: CreateUserInput) {
  const existing = await User.findOne({ email: input.email.toLowerCase().trim() });
  if (existing) {
    throw new ApiError(409, "A user with this email already exists");
  }

  if (input.employeeId) {
    const existingEmployeeId = await User.findOne({ employeeId: input.employeeId.toUpperCase().trim() });
    if (existingEmployeeId) {
      throw new ApiError(409, "A user with this employee ID already exists");
    }
  }

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

  return User.create({
    name: input.name,
    email: input.email,
    employeeId: input.employeeId,
    passwordHash,
    designation: input.designation,
    phone: input.phone,
    department: input.department || null,
    location: input.location || null,
    isAdmin: input.isAdmin ?? false,
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
};

export async function listUsers(input: ListUsersInput) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = {};
  if (input.status) filter.status = input.status;
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

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getUserById(id: string) {
  const user = await User.findById(id).populate("department", "name").populate("location", "name");
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

export async function updateUser(id: string, input: UpdateUserInput) {
  const user = await getUserById(id);

  if (input.employeeId && input.employeeId.toUpperCase().trim() !== user.employeeId) {
    const existing = await User.findOne({ employeeId: input.employeeId.toUpperCase().trim() });
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
  input: { isAdmin?: boolean; permissions?: Partial<PermissionsShape> }
) {
  const user = await getUserById(id);

  if (user.isAdmin && input.isAdmin === false) {
    const otherAdmins = await User.countDocuments({ _id: { $ne: id }, isAdmin: true });
    if (otherAdmins === 0) {
      throw new ApiError(409, "Cannot remove Admin from the last remaining Admin");
    }
  }

  if (input.isAdmin !== undefined) user.isAdmin = input.isAdmin;
  if (input.permissions) {
    user.permissions = { ...user.permissions, ...input.permissions } as PermissionsShape;
  }
  user.tokenVersion += 1; // permission change takes effect immediately, everywhere
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

  if (user.isAdmin) {
    const otherAdmins = await User.countDocuments({ _id: { $ne: id }, isAdmin: true });
    if (otherAdmins === 0) {
      throw new ApiError(409, "Cannot delete the last remaining Admin");
    }
  }

  const snapshot = { name: user.name, email: user.email, isAdmin: user.isAdmin };
  await user.deleteOne();

  return snapshot;
}
