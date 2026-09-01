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
  designation: z.string().optional(),
  phone: z.string().optional(),
  department: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
  isAdmin: z.boolean().optional().default(false),
  permissions: permissionsSchema.optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  employeeId: z.string().min(1).optional(),
  designation: z.string().optional(),
  phone: z.string().optional(),
  department: z.string().min(1).optional(),
  location: z.string().min(1).optional(),
});

export const updateUserPermissionsSchema = z.object({
  isAdmin: z.boolean().optional(),
  permissions: permissionsSchema.optional(),
});

export const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const setLeaveStatusSchema = z.object({
  isOnLeave: z.boolean(),
  backupAgentId: z.string().min(1).optional(),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
  role: z.enum(["superAdmin", "orgAdmin", "teamMember"]).optional(),
});

export const userIdParamsSchema = z.object({
  id: z.string().min(1),
});
