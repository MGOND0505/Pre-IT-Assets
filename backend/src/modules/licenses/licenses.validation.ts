import { z } from "zod";
import { LICENSE_STATUSES, LICENSE_TYPES } from "../../models/License";

const objectId = z.string().min(1);

export const createLicenseSchema = z.object({
  softwareName: z.string().min(1),
  productName: z.string().optional().default(""),
  publisher: z.string().optional().default(""),
  category: objectId.optional(),
  licenseType: z.enum(LICENSE_TYPES).optional(),
  vendor: objectId.optional(),
  purchaseDate: z.coerce.date().optional(),
  startDate: z.coerce.date().optional(),
  expiryDate: z.coerce.date().optional(),
  renewalDate: z.coerce.date().optional(),
  totalLicenses: z.coerce.number().int().min(1).optional(),
  assignedUsers: z.array(objectId).optional(),
  costPerLicense: z.coerce.number().nonnegative().optional(),
  totalCost: z.coerce.number().nonnegative().optional(),
  department: objectId.optional(),
  status: z.enum(LICENSE_STATUSES).optional(),
  poNumber: z.string().optional().default(""),
  invoiceNumber: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export const updateLicenseSchema = createLicenseSchema.partial();

export const listLicensesQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  status: z.enum(LICENSE_STATUSES).optional(),
  category: objectId.optional(),
  vendor: objectId.optional(),
});

export const licenseIdParamsSchema = z.object({
  id: z.string().min(1),
});
