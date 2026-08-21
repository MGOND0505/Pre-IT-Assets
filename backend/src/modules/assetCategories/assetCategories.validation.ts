import { z } from "zod";

export const createAssetCategorySchema = z.object({
  name: z.string().min(1),
  prefix: z
    .string()
    .min(2)
    .max(6)
    .regex(/^[A-Za-z0-9]+$/, "Prefix must be letters/digits only"),
  description: z.string().optional().default(""),
});

export const updateAssetCategorySchema = z.object({
  name: z.string().min(1).optional(),
  prefix: z
    .string()
    .min(2)
    .max(6)
    .regex(/^[A-Za-z0-9]+$/, "Prefix must be letters/digits only")
    .optional(),
  description: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const listAssetCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const assetCategoryIdParamsSchema = z.object({
  id: z.string().min(1),
});
