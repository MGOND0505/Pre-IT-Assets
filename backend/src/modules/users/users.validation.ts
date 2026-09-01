import { z } from "zod";
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from "../../config/permissions";

const modulePermissionsSchema = z.object(
  Object.fromEntries(PERMISSION_ACTIONS.map((action) => [action, z.boolean().optional().default(false)]))
);

export const permissionsSchema = z.object(
  Object.fromEntries(PERMISSION_MODULES.map((moduleKey) => [moduleKey, modulePermissionsSchema.optional()]))
);

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  employeeId: z.string().min(1).optional(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  designation: z.string().min(1).optional(),
  phone: z.string().optional(),
  department: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  isAdmin: z.boolean().optional().default(false),
  employeeTier: z.enum(["subAdmin", "employee"]).optional(),
  permissions: permissionsSchema.optional(),
  // A saved Role template to apply at creation time - see users.service.ts#createUser. Its
  // permissions/portalType take precedence over `permissions`/`employeeTier` above when given.
  roleId: z.string().min(1).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  employeeId: z.string().min(1).optional(),
  designation: z.string().min(1).optional(),
  phone: z.string().optional(),
  department: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
});

export const updateUserPermissionsSchema = z.object({
  isAdmin: z.boolean().optional(),
  employeeTier: z.enum(["subAdmin", "employee"]).nullable().optional(),
  permissions: permissionsSchema.optional(),
  // A saved Role id copies its permissions+portalType onto the user (see
  // users.service.ts#updateUserPermissions); explicit null clears roleTemplate only; omitted
  // leaves roleTemplate untouched.
  roleId: z.string().min(1).nullable().optional(),
});

export const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const bulkApplyDefaultPermissionsSchema = z.object({
  userIds: z.array(z.string().min(1)).min(1, "Select at least one user").max(500),
  // When given, apply this saved Role's permissions+portalType+roleTemplate instead of the org's
  // default employee template - see users.service.ts#bulkApplyDefaultPermissions.
  roleId: z.string().min(1).optional(),
});

export const setLeaveStatusSchema = z.object({
  isOnLeave: z.boolean(),
  backupAgentId: z.string().min(1).optional(),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().max(100).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
  role: z.enum(["superAdmin", "orgAdmin", "teamMember"]).optional(),
});

// Backs GET /api/users (globalUsers.routes.ts) - the flat, cross-organization Super Admin user
// directory (Phase 8). Same page/limit/search/status shape as listUsersQuerySchema above, plus an
// optional organizationId to narrow to one specific org (there's no implicit org here, unlike the
// org-scoped list, so this is the only filter that can ever scope it to one).
export const listGlobalUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().max(100).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
  organizationId: z.string().min(1).optional(),
});

export const lookupUsersQuerySchema = z.object({
  search: z.string().max(100).optional(),
});

export const userIdParamsSchema = z.object({
  id: z.string().min(1),
});

const importStr = () => z.string().max(500).optional().default("");

const mappedUserImportRowSchema = z.object({
  name: importStr(),
  email: importStr(),
  employeeId: importStr(),
  designationName: importStr(),
  phone: importStr(),
  departmentName: importStr(),
  locationName: importStr(),
});

export const confirmUserImportSchema = z.object({
  rows: z
    .array(
      z.object({
        rowIndex: z.number().int(),
        mapped: mappedUserImportRowSchema,
        classification: z.enum(["new", "updated", "duplicate", "invalid"]),
        reason: z.string().max(500).optional(),
        existingId: z.string().optional(),
      })
    )
    .max(2000),
});
