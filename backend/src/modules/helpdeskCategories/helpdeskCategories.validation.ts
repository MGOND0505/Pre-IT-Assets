import { z } from "zod";

export const createHelpdeskCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
});

export const updateHelpdeskCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const listHelpdeskCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const helpdeskCategoryIdParamsSchema = z.object({
  id: z.string().min(1),
});
