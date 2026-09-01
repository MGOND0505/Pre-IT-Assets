import { z } from "zod";

export const createVendorSchema = z.object({
  name: z.string().min(1),
  contactPerson: z.string().optional().default(""),
  email: z.string().email().optional().or(z.literal("")).default(""),
  phone: z.string().optional().default(""),
  service: z.string().optional().default(""),
  address: z.string().optional().default(""),
  contractStart: z.coerce.date().optional(),
  contractEnd: z.coerce.date().optional(),
  notes: z.string().optional().default(""),
});

export const updateVendorSchema = z.object({
  name: z.string().min(1).optional(),
  contactPerson: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  service: z.string().optional(),
  address: z.string().optional(),
  contractStart: z.coerce.date().optional(),
  contractEnd: z.coerce.date().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
  notes: z.string().optional(),
});

export const listVendorsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().max(100).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const vendorIdParamsSchema = z.object({
  id: z.string().min(1),
});

const importStr = () => z.string().max(500).optional().default("");

const mappedVendorImportRowSchema = z.object({
  name: importStr(),
  contactPerson: importStr(),
  email: importStr(),
  phone: importStr(),
  service: importStr(),
  address: importStr(),
  contractStart: importStr(),
  contractEnd: importStr(),
  status: importStr(),
  notes: importStr(),
});

export const confirmVendorImportSchema = z.object({
  rows: z
    .array(
      z.object({
        rowIndex: z.number().int(),
        mapped: mappedVendorImportRowSchema,
        classification: z.enum(["new", "updated", "duplicate", "invalid"]),
        reason: z.string().max(500).optional(),
        existingId: z.string().optional(),
      })
    )
    .max(2000),
});
