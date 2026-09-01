import { z } from "zod";

export const createHelpdeskPrioritySchema = z.object({
  name: z.string().min(1),
  order: z.coerce.number().int().optional().default(0),
  color: z.string().optional(),
  slaResponseMinutes: z.coerce.number().int().min(1),
  slaResolutionMinutes: z.coerce.number().int().min(1),
});

export const updateHelpdeskPrioritySchema = z.object({
  name: z.string().min(1).optional(),
  order: z.coerce.number().int().optional(),
  color: z.string().optional(),
  slaResponseMinutes: z.coerce.number().int().min(1).optional(),
  slaResolutionMinutes: z.coerce.number().int().min(1).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const listHelpdeskPrioritiesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().max(100).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const helpdeskPriorityIdParamsSchema = z.object({
  id: z.string().min(1),
});

const importStr = () => z.string().max(500).optional().default("");

const mappedHelpdeskPriorityImportRowSchema = z.object({
  name: importStr(),
  order: importStr(),
  color: importStr(),
  slaResponseMinutes: importStr(),
  slaResolutionMinutes: importStr(),
});

export const confirmHelpdeskPriorityImportSchema = z.object({
  rows: z
    .array(
      z.object({
        rowIndex: z.number().int(),
        mapped: mappedHelpdeskPriorityImportRowSchema,
        classification: z.enum(["new", "updated", "duplicate", "invalid"]),
        reason: z.string().max(500).optional(),
        existingId: z.string().optional(),
      })
    )
    .max(2000),
  fileName: z.string().max(255).optional(),
});
