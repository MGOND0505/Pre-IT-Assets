import { z } from "zod";

export const createDepartmentSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
});

export const updateDepartmentSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const listDepartmentsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const departmentIdParamsSchema = z.object({
  id: z.string().min(1),
});
