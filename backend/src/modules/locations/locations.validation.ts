import { z } from "zod";

export const createLocationSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional().default(""),
  city: z.string().optional().default(""),
  state: z.string().optional().default(""),
  country: z.string().optional().default(""),
});

export const updateLocationSchema = z.object({
  name: z.string().min(1).optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const listLocationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().max(100).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const locationIdParamsSchema = z.object({
  id: z.string().min(1),
});

const importStr = () => z.string().max(500).optional().default("");

const mappedLocationImportRowSchema = z.object({
  name: importStr(),
  address: importStr(),
  city: importStr(),
  state: importStr(),
  country: importStr(),
});

export const confirmLocationImportSchema = z.object({
  rows: z
    .array(
      z.object({
        rowIndex: z.number().int(),
        mapped: mappedLocationImportRowSchema,
        classification: z.enum(["new", "updated", "duplicate", "invalid"]),
        reason: z.string().max(500).optional(),
        existingId: z.string().optional(),
      })
    )
    .max(2000),
  fileName: z.string().max(255).optional(),
});
