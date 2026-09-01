import { z } from "zod";
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from "../../config/permissions";
import { ROLE_PORTAL_TYPES } from "../../models/Role";

// Mirrors users.validation.ts's own modulePermissionsSchema/permissionsSchema exactly, so a
// Role's stored permissions always validate against the identical shape a user's do.
const modulePermissionsSchema = z.object(
  Object.fromEntries(PERMISSION_ACTIONS.map((action) => [action, z.boolean().optional().default(false)]))
);

export const permissionsSchema = z.object(
  Object.fromEntries(PERMISSION_MODULES.map((moduleKey) => [moduleKey, modulePermissionsSchema.optional()]))
);

export const createRoleSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional().default(""),
  portalType: z.enum(ROLE_PORTAL_TYPES),
  permissions: permissionsSchema.optional(),
});

export const updateRoleSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  portalType: z.enum(ROLE_PORTAL_TYPES).optional(),
  permissions: permissionsSchema.optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const listRolesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().max(100).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
  portalType: z.enum(ROLE_PORTAL_TYPES).optional(),
});

export const roleIdParamsSchema = z.object({
  id: z.string().min(1),
});
