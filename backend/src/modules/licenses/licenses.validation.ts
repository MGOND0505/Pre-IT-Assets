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
  search: z.string().max(100).optional(),
  status: z.enum(LICENSE_STATUSES).optional(),
  category: objectId.optional(),
  vendor: objectId.optional(),
});

export const licenseIdParamsSchema = z.object({
  id: z.string().min(1),
});

const importStr = () => z.string().max(500).optional().default("");

const mappedLicenseImportRowSchema = z.object({
  licenseIdRaw: importStr(),
  softwareName: importStr(),
  productName: importStr(),
  publisher: importStr(),
  licenseType: importStr(),
  vendorName: importStr(),
  departmentName: importStr(),
  purchaseDate: importStr(),
  expiryDate: importStr(),
  totalLicenses: importStr(),
  costPerLicense: importStr(),
  status: importStr(),
  poNumber: importStr(),
  invoiceNumber: importStr(),
  notes: importStr(),
});

const importClassification = z.enum(["new", "updated", "duplicate", "invalid"]);

export const confirmLicenseImportSchema = z.object({
  mode: z.enum(["catalog", "per-user"]).optional(),
  rows: z
    .array(
      z.object({
        rowIndex: z.number().int(),
        mapped: mappedLicenseImportRowSchema,
        classification: importClassification,
        reason: z.string().max(500).optional(),
        existingId: z.string().optional(),
        existingLicenseId: z.string().optional(),
        changedFields: z.array(z.string()).optional(),
      })
    )
    .max(2000)
    .optional()
    .default([]),
  groups: z
    .array(
      z.object({
        softwareName: z.string().max(500),
        seatCount: z.number().int(),
        emails: z.array(z.string().max(320)).max(5000),
        resolvedUserIds: z.array(z.string()).max(5000),
        unresolvedEmails: z.array(z.string().max(320)).max(5000),
        classification: importClassification,
        reason: z.string().max(500).optional(),
        existingId: z.string().optional(),
        existingLicenseId: z.string().optional(),
      })
    )
    .max(2000)
    .optional()
    .default([]),
});
