import { z } from "zod";

export const createHelpdeskCategorySchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  defaultAgent: z.string().min(1).nullable().optional(),
});

export const updateHelpdeskCategorySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  defaultAgent: z.string().min(1).nullable().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const listHelpdeskCategoriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().max(100).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const helpdeskCategoryIdParamsSchema = z.object({
  id: z.string().min(1),
});

const importStr = () => z.string().max(500).optional().default("");

const mappedHelpdeskCategoryImportRowSchema = z.object({
  name: importStr(),
  description: importStr(),
  defaultAgentEmail: importStr(),
});

export const confirmHelpdeskCategoryImportSchema = z.object({
  rows: z
    .array(
      z.object({
        rowIndex: z.number().int(),
        mapped: mappedHelpdeskCategoryImportRowSchema,
        classification: z.enum(["new", "updated", "duplicate", "invalid"]),
        reason: z.string().max(500).optional(),
        existingId: z.string().optional(),
      })
    )
    .max(2000),
  fileName: z.string().max(255).optional(),
});
