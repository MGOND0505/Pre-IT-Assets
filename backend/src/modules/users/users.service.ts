import bcrypt from "bcryptjs";
import { User, type IUser } from "../../models/User";
import { Role } from "../../models/Role";
import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";
import { emptyPermissions, subAdminDefaultPermissions, type PermissionsShape } from "../../config/permissions";
import { getOrgRetentionDays, withRecycleBinMeta } from "../../utils/recycleBin";
import { getPasswordPolicy, getDefaultEmployeePermissions } from "../settings/settings.service";
import { validatePasswordAgainstPolicy, assertPasswordNotReused, pushPasswordHistory } from "../../utils/passwordPolicy";
import { tokenSearchFilter, fuzzyFallback } from "../../utils/smartSearch";

const USER_SEARCH_FIELDS = ["name", "email", "employeeId"];
const USER_POPULATE_FIELDS = [
  { path: "department", select: "name" },
  { path: "location", select: "name" },
  { path: "designation", select: "name" },
  { path: "roleTemplate", select: "name portalType" },
];

/** Looks up a saved Role template for this org, 400s if it doesn't exist/belong here - shared by
 * createUser, updateUserPermissions, and bulkApplyDefaultPermissions, the three places a Role is
 * ever applied (copied) onto a user. */
async function findRoleOrThrow(roleId: string, organizationId: string) {
  const role = await Role.findOne({ _id: roleId, organization: organizationId, isDeleted: false });
  if (!role) throw new ApiError(400, "Role not found");
  return role;
}

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
  employeeTier?: "subAdmin" | "employee";
  permissions?: Partial<PermissionsShape>;
  // A saved Role template to apply at creation time - see findRoleOrThrow. When provided, its
  // permissions/portalType take precedence over both `permissions` and `employeeTier` below, and
  // `roleTemplate` is set on the created user for labeling/reuse traceability. Purely a one-time
  // copy - never a live binding (see models/Role.ts's doc comment).
  roleId?: string;
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

  const policy = await getPasswordPolicy(organizationId);
  const violations = validatePasswordAgainstPolicy(input.password, policy);
  if (violations.length > 0) throw new ApiError(400, violations.join(" "));

  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_SALT_ROUNDS);

  const role = input.roleId ? await findRoleOrThrow(input.roleId, organizationId) : null;

  // Explicit permissions (the manual "Add user" dialog always sends its own for Admin/Sub Admin,
  // whatever the admin left checked) are honored verbatim; omitting the field entirely (the
  // dialog's "Employee" selection, or bulk import) falls back to a tier-appropriate default -
  // subAdminDefaultPermissions() for Sub Admin, the org's configured default employee template
  // otherwise - see settings.service.ts#getDefaultEmployeePermissions, the one place THAT
  // decision is made. A saved Role (if given) takes precedence over all of that.
  const permissions = role
    ? role.permissions
    : input.permissions
      ? { ...emptyPermissions(), ...input.permissions }
      : input.employeeTier === "subAdmin"
        ? subAdminDefaultPermissions()
        : await getDefaultEmployeePermissions(organizationId);

  return User.create({
    organization: organizationId,
    name: input.name,
    email: input.email,
    employeeId: input.employeeId,
    passwordHash,
    designation: input.designation || null,
    phone: input.phone,
    department: input.department || null,
    location: input.location || null,
    role: input.isAdmin ? "orgAdmin" : "teamMember",
    employeeTier: input.isAdmin ? null : role ? role.portalType : (input.employeeTier ?? null),
    permissions,
    roleTemplate: role ? role._id : null,
    createdBy: input.createdBy,
    mustChangePassword: true,
    passwordChangedAt: new Date(),
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
  let baseFilterWithoutSearch: Record<string, unknown> | undefined;
  if (input.search) {
    baseFilterWithoutSearch = { ...filter };
    filter.$or = [tokenSearchFilter(USER_SEARCH_FIELDS, input.search)];
  }

  const [items, total] = await Promise.all([
    User.find(filter)
      .populate(USER_POPULATE_FIELDS)
      .sort({ createdDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  const retentionDays = await getOrgRetentionDays(organizationId);

  if (total === 0 && input.search && baseFilterWithoutSearch) {
    const fallbackDocs = await fuzzyFallback<InstanceType<typeof User>>(User, baseFilterWithoutSearch, USER_SEARCH_FIELDS, input.search);
    if (fallbackDocs.length > 0) {
      const populated = await User.populate(fallbackDocs, USER_POPULATE_FIELDS);
      return { items: withRecycleBinMeta(populated, retentionDays), total: populated.length, page: 1, limit, totalPages: 1 };
    }
  }

  return { items: withRecycleBinMeta(items, retentionDays), total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getUserById(id: string, organizationId: string) {
  const user = await User.findOne({ _id: id, organization: organizationId, isDeleted: false })
    .populate("department", "name")
    .populate("location", "name")
    .populate("roleTemplate", "name portalType");
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
  input: {
    isAdmin?: boolean;
    employeeTier?: "subAdmin" | "employee" | null;
    permissions?: Partial<PermissionsShape>;
    // undefined: unchanged (default). A saved Role id: copy its permissions/portalType onto this
    // user and remember it via roleTemplate - same one-time-copy semantics as createUser. Explicit
    // null: clear roleTemplate only (an admin reverting to manual/no-template permissions),
    // without otherwise touching permissions/employeeTier.
    roleId?: string | null;
  },
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
  // Lets an admin retier an existing account later (e.g. Employee -> Sub Admin) without
  // recreating it - the model's own pre-validate hook forces this back to null if the role
  // above ends up non-teamMember, so an isAdmin:true + employeeTier combo can't linger.
  if (input.employeeTier !== undefined) user.employeeTier = input.employeeTier;
  if (input.permissions) {
    user.permissions = { ...user.permissions, ...input.permissions } as PermissionsShape;
  }

  if (input.roleId) {
    const role = await findRoleOrThrow(input.roleId, organizationId);
    user.permissions = role.permissions;
    user.employeeTier = role.portalType;
    user.roleTemplate = role._id as never;
  } else if (input.roleId === null) {
    user.roleTemplate = null;
  }

  user.tokenVersion += 1; // permission change takes effect immediately, everywhere
  await user.save();
  return user;
}

/** Re-applies either the org's current default employee permission template, or (when `roleId`
 * is given) one saved Role's permissions+portalType+roleTemplate, to a batch of existing users at
 * once - e.g. after an admin changes the template and wants everyone still on the old one to
 * catch up, without re-editing each account by hand. Only ever touches `teamMember` accounts - an
 * `orgAdmin`'s access comes from their role's `isAdmin` bypass, not this matrix, so silently
 * overwriting their permissions object here would be pointless at best. Skips (rather than fails
 * the whole batch for) anyone not found or not a teamMember, same "isolate the bad rows"
 * convention as every bulk-import confirm handler in this app. */
export async function bulkApplyDefaultPermissions(userIds: string[], organizationId: string, roleId?: string) {
  const role = roleId ? await findRoleOrThrow(roleId, organizationId) : null;
  const permissions = role ? role.permissions : await getDefaultEmployeePermissions(organizationId);

  let updated = 0;
  const skipped: string[] = [];

  for (const id of userIds) {
    const user = await User.findOne({ _id: id, organization: organizationId, isDeleted: false });
    if (!user) {
      skipped.push(id);
      continue;
    }
    if (user.role !== "teamMember") {
      skipped.push(`${user.email} (not an Employee account)`);
      continue;
    }
    user.permissions = permissions;
    if (role) {
      user.employeeTier = role.portalType;
      user.roleTemplate = role._id as never;
    }
    user.tokenVersion += 1; // permission change takes effect immediately, everywhere
    await user.save();
    updated += 1;
  }

  return { updated, skipped };
}

export async function setUserStatus(id: string, status: "Active" | "Inactive", organizationId: string) {
  const user = await getUserById(id, organizationId);
  user.status = status;
  user.tokenVersion += 1; // invalidate any existing sessions immediately
  await user.save();
  return user;
}

export async function setLeaveStatus(
  id: string,
  input: { isOnLeave: boolean; backupAgentId?: string },
  organizationId: string
) {
  const user = await getUserById(id, organizationId);

  if (input.isOnLeave) {
    const backupId = input.backupAgentId ?? (user.backupAgent ? String(user.backupAgent) : null);
    if (!backupId) throw new ApiError(400, "Select a backup agent before marking this user on leave");
    if (backupId === id) throw new ApiError(400, "A user cannot be their own backup agent");

    const backup = await User.findOne({
      _id: backupId,
      organization: organizationId,
      status: "Active",
      isDeleted: false,
      isOnLeave: { $ne: true },
    });
    if (!backup) throw new ApiError(400, "The selected backup agent is not available");

    user.backupAgent = backup._id as never;
    user.isOnLeave = true;
  } else {
    user.isOnLeave = false;
  }

  await user.save();
  return user;
}

export async function adminResetPassword(id: string, newPassword: string, organizationId: string) {
  const user = await User.findOne({ _id: id, organization: organizationId, isDeleted: false }).select(
    "+passwordHash +passwordHistory"
  );
  if (!user) throw new ApiError(404, "User not found");

  const policy = await getPasswordPolicy(organizationId);
  const violations = validatePasswordAgainstPolicy(newPassword, policy);
  if (violations.length > 0) throw new ApiError(400, violations.join(" "));
  await assertPasswordNotReused(newPassword, user, policy.historyLimit);

  const oldHash = user.passwordHash;
  user.passwordHash = await bcrypt.hash(newPassword, env.BCRYPT_SALT_ROUNDS);
  pushPasswordHistory(user, oldHash, policy.historyLimit);
  user.passwordChangedAt = new Date();
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
