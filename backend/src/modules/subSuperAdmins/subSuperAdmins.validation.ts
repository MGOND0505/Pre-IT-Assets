import { z } from "zod";
import { PERMISSION_MODULES } from "../../config/permissions";

const modulePermissionsSchema = z.object({
  view: z.boolean().optional().default(false),
  create: z.boolean().optional().default(false),
  update: z.boolean().optional().default(false),
  delete: z.boolean().optional().default(false),
  import: z.boolean().optional().default(false),
  export: z.boolean().optional().default(false),
});

const permissionsSchema = z.object(
  Object.fromEntries(PERMISSION_MODULES.map((moduleKey) => [moduleKey, modulePermissionsSchema.optional()]))
);

const orgAccessSchema = z
  .array(
    z.object({
      organization: z.string().min(1),
      permissions: permissionsSchema.optional().default({}),
    })
  )
  .default([]);

export const createSubSuperAdminSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  orgAccess: orgAccessSchema,
});

export const updateSubSuperAdminSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

export const updateSubSuperAdminAccessSchema = z.object({
  orgAccess: orgAccessSchema,
});

export const setSubSuperAdminStatusSchema = z.object({
  status: z.enum(["Active", "Inactive"]),
});

export const resetSubSuperAdminPasswordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
});

export const subSuperAdminIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const updateGrantedOrganizationRetentionSchema = z.object({
  recycleBinRetentionDays: z.coerce.number().int().min(30).max(180),
});

export const grantedOrganizationIdParamsSchema = z.object({
  id: z.string().min(1),
});
