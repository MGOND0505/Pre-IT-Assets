import { z } from "zod";
import { PERMISSION_ACTIONS, PERMISSION_MODULES } from "../../config/permissions";

const modulePermissionsSchema = z.object(
  Object.fromEntries(PERMISSION_ACTIONS.map((action) => [action, z.boolean().optional().default(false)]))
);

const permissionsSchema = z.object(
  Object.fromEntries(PERMISSION_MODULES.map((moduleKey) => [moduleKey, modulePermissionsSchema.optional()]))
);

export const createAccessRequestSchema = z.object({
  organization: z.string().min(1),
  requestedPermissions: permissionsSchema.optional().default({}),
  reason: z.string().optional(),
});

export const decideAccessRequestSchema = z.object({
  decision: z.enum(["Approved", "Denied"]),
});

export const accessRequestIdParamsSchema = z.object({
  id: z.string().min(1),
});
