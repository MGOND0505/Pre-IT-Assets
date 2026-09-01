import { z } from "zod";

export const createLicenseCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
});

export const updateLicenseCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const listLicenseCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().max(100).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const licenseCategoryIdParamsSchema = z.object({
  id: z.string().min(1),
});

const importStr = () => z.string().max(500).optional().default("");

const mappedLicenseCategoryImportRowSchema = z.object({
  name: importStr(),
  description: importStr(),
});

export const confirmLicenseCategoryImportSchema = z.object({
  rows: z
    .array(
      z.object({
        rowIndex: z.number().int(),
        mapped: mappedLicenseCategoryImportRowSchema,
        classification: z.enum(["new", "updated", "duplicate", "invalid"]),
        reason: z.string().max(500).optional(),
        existingId: z.string().optional(),
      })
    )
    .max(2000),
  fileName: z.string().max(255).optional(),
});
