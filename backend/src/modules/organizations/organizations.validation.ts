import { z } from "zod";
import { ENTITLEMENT_MODULES } from "../../config/permissions";

const validityFields = {
  enabledModules: z.array(z.enum(ENTITLEMENT_MODULES)).optional(),
  validFrom: z.coerce.date().optional(),
  validUntil: z.coerce.date().optional(),
  gracePeriodDays: z.coerce.number().int().min(0).optional(),
  recycleBinRetentionDays: z.coerce.number().int().min(30).max(180).optional(),
};

function refineValidityWindow<T extends { validFrom?: Date; validUntil?: Date }>(schema: z.ZodType<T>) {
  return schema.refine((data) => !data.validFrom || !data.validUntil || data.validUntil > data.validFrom, {
    message: "Validity end date must be after the start date",
    path: ["validUntil"],
  });
}

export const listOrganizationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const organizationIdParamsSchema = z.object({
  idOrSlug: z.string().min(1),
});

export const createOrganizationSchema = refineValidityWindow(
  z.object({
    name: z.string().min(1),
    slug: z.string().min(1),
    code: z.string().min(1).optional(),
    email: z.string().email().or(z.literal("")).optional(),
    phone: z.string().optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
    status: z.enum(["Active", "Inactive"]).optional(),
    ...validityFields,
    adminName: z.string().min(1),
    adminEmail: z.string().email(),
    adminPassword: z.string().min(8, "Password must be at least 8 characters"),
  })
);

export const updateOrganizationSchema = refineValidityWindow(
  z.object({
    name: z.string().min(1).optional(),
    code: z.string().min(1).optional(),
    email: z.string().email().or(z.literal("")).optional(),
    phone: z.string().optional(),
    addressLine1: z.string().optional(),
    addressLine2: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    country: z.string().optional(),
    postalCode: z.string().optional(),
    ...validityFields,
  })
);

export const setOrganizationStatusSchema = z.object({
  status: z.enum(["Active", "Inactive"]),
});
