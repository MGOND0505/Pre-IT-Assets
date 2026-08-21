import { z } from "zod";

export const updateSettingsSchema = z.object({
  assetIdCompanyPrefix: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/)
    .optional(),
  warrantyAlertDays: z.coerce.number().int().positive().optional(),
  amcAlertDays: z.coerce.number().int().positive().optional(),
  licenseRenewalAlertDays: z.array(z.coerce.number().int().positive()).min(1).optional(),
  licenseIdPrefix: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/)
    .optional(),
});
