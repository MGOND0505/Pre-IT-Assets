import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  permissionKeys: z.array(z.string()).default([]),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  permissionKeys: z.array(z.string()).optional(),
});

export const roleIdParamsSchema = z.object({
  id: z.string().min(1),
});
