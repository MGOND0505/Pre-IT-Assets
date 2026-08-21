import { z } from "zod";

const objectId = z.string().min(1);

export const assignAssetSchema = z.object({
  assignedTo: objectId.optional(),
  department: objectId.optional(),
  location: objectId.optional(),
  remarks: z.string().optional().default(""),
});

export const transferAssetSchema = z.object({
  toUser: objectId.optional(),
  toLocation: objectId.optional(),
  toDepartment: objectId.optional(),
  reason: z.string().optional().default(""),
  approvedBy: objectId.optional(),
  remarks: z.string().optional().default(""),
});

export const returnAssetSchema = z.object({
  remarks: z.string().optional().default(""),
});

export const retireAssetSchema = z.object({
  reason: z.string().optional().default(""),
  remarks: z.string().optional().default(""),
});
