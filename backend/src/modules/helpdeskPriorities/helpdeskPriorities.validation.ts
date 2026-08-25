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
  search: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const helpdeskPriorityIdParamsSchema = z.object({
  id: z.string().min(1),
});
