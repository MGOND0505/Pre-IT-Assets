import { z } from "zod";

const permissionAreaSchema = z.object({
  read: z.boolean().optional().default(false),
  add: z.boolean().optional().default(false),
  edit: z.boolean().optional().default(false),
  delete: z.boolean().optional().default(false),
});

export const permissionsSchema = z.object({
  assets: permissionAreaSchema.optional(),
  licenses: permissionAreaSchema.optional(),
  reports: z.object({ read: z.boolean().optional().default(false) }).optional(),
});

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

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const userIdParamsSchema = z.object({
  id: z.string().min(1),
});
