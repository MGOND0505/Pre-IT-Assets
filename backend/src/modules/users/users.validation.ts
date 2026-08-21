import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  roleIds: z.array(z.string().min(1)).min(1, "At least one role is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  designation: z.string().optional(),
  phone: z.string().optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  designation: z.string().optional(),
  phone: z.string().optional(),
});

export const updateUserRolesSchema = z.object({
  roleIds: z.array(z.string().min(1)).min(1, "At least one role is required"),
});

export const adminResetPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  role: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const userIdParamsSchema = z.object({
  id: z.string().min(1),
});
