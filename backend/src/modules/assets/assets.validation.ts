import { z } from "zod";
import { ASSET_STATUSES } from "../../models/Asset";
import { ASSET_DOCUMENT_TYPES } from "../../models/AssetDocument";

const objectId = z.string().min(1);

export const createAssetSchema = z.object({
  name: z.string().min(1),
  category: objectId,
  assetType: z.string().optional().default(""),
  manufacturer: z.string().optional().default(""),
  model: z.string().optional().default(""),
  serialNumber: z.string().optional().default(""),
  serviceTag: z.string().optional().default(""),
  hostname: z.string().optional().default(""),
  ipAddress: z.string().optional().default(""),
  macAddress: z.string().optional().default(""),
  operatingSystem: z.string().optional().default(""),
  configuration: z.string().optional().default(""),
  purchaseDate: z.coerce.date().optional(),
  purchaseCost: z.coerce.number().nonnegative().optional(),
  vendor: objectId.optional(),
  poNumber: z.string().optional().default(""),
  invoiceNumber: z.string().optional().default(""),
  warrantyStart: z.coerce.date().optional(),
  warrantyEnd: z.coerce.date().optional(),
  amcStart: z.coerce.date().optional(),
  amcEnd: z.coerce.date().optional(),
  location: objectId.optional(),
  department: objectId.optional(),
  assignedUser: objectId.optional(),
  status: z.enum(ASSET_STATUSES).optional(),
  condition: z.string().optional().default(""),
  notes: z.string().optional().default(""),
});

export const updateAssetSchema = createAssetSchema.partial();

export const listAssetsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  status: z.enum(ASSET_STATUSES).optional(),
  category: objectId.optional(),
  location: objectId.optional(),
  department: objectId.optional(),
  vendor: objectId.optional(),
  purchaseDateFrom: z.coerce.date().optional(),
  purchaseDateTo: z.coerce.date().optional(),
  sortBy: z.enum(["name", "assetId", "purchaseDate", "createdDate", "status"]).optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
});

export const assetIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const assetDocumentParamsSchema = z.object({
  id: z.string().min(1),
  docId: z.string().min(1),
});

export const uploadAssetDocumentBodySchema = z.object({
  type: z.enum(ASSET_DOCUMENT_TYPES).optional().default("Other"),
});
