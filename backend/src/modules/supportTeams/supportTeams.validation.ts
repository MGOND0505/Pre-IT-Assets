import { z } from "zod";

const memberSchema = z.object({
  user: z.string().min(1),
  isActive: z.boolean().optional().default(true),
});

export const createSupportTeamSchema = z.object({
  name: z.string().min(1),
  tier: z.enum(["L1", "L2", "L3"]),
  categories: z.array(z.string()).optional().default([]),
  departments: z.array(z.string()).optional().default([]),
  locations: z.array(z.string()).optional().default([]),
  members: z.array(memberSchema).optional().default([]),
});

export const updateSupportTeamSchema = z.object({
  name: z.string().min(1).optional(),
  tier: z.enum(["L1", "L2", "L3"]).optional(),
  categories: z.array(z.string()).optional(),
  departments: z.array(z.string()).optional(),
  locations: z.array(z.string()).optional(),
  members: z.array(memberSchema).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const listSupportTeamsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  tier: z.enum(["L1", "L2", "L3"]).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const supportTeamIdParamsSchema = z.object({
  id: z.string().min(1),
});
