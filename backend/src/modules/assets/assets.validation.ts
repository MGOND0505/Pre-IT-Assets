import { z } from "zod";
import { ASSET_STATUSES } from "../../models/Asset";
import { ASSET_DOCUMENT_TYPES } from "../../models/AssetDocument";

const objectId = z.string().min(1);
const str = () => z.string().optional().default("");
const importStr = () => z.string().max(500).optional().default("");

export const createAssetSchema = z.object({
  // Only ever honored when the caller has assets:editAssetId (enforced in the controller, which
  // strips this field before it reaches the service otherwise) - omitted, it falls back to the
  // existing auto-generated VNR-<category>-000001 sequence.
  assetId: z.string().trim().min(1).optional(),
  name: z.string().min(1),
  category: objectId,
  assetType: str(),
  deviceType: str(),
  manufacturer: str(),
  model: str(),
  serialNumber: str(),
  serviceTag: str(),
  imei: str(),
  color: str(),
  hostname: str(),
  ipAddress: str(),
  macAddress: str(),
  operatingSystem: str(),
  operatingSystemLicense: str(),
  configuration: str(),
  processor: str(),
  laptopGeneration: str(),
  graphicsCard: str(),
  ram: str(),
  storage: str(),
  adapterSerialNumber: str(),
  miscAccessories: str(),
  adMember: str(),
  antivirusInstalled: str(),
  remoteSoftware: str(),
  emailLicense: str(),
  canvaLicense: str(),
  microsoftOffice: str(),
  microsoftProject: str(),
  powerBi: str(),
  autoCad: str(),
  zwCad: str(),
  photoshop: str(),
  creativeCloudPro: str(),
  illustrator: str(),
  acrobatPro: str(),
  sketchUpPro: str(),
  rocketReachPro: str(),
  d5Render: str(),
  zoomLicense: str(),
  sharedFolderAccess: str(),
  purchaseDate: z.coerce.date().optional(),
  purchaseCost: z.coerce.number().nonnegative().optional(),
  quantity: z.coerce.number().nonnegative().optional(),
  vendor: objectId.optional(),
  companyName: str(),
  poNumber: str(),
  invoiceNumber: str(),
  warrantyStart: z.coerce.date().optional(),
  warrantyEnd: z.coerce.date().optional(),
  amcStart: z.coerce.date().optional(),
  amcEnd: z.coerce.date().optional(),
  location: objectId.optional(),
  subLocation: str(),
  department: objectId.optional(),
  assignedUser: objectId.nullable().optional(),
  userAccessLevel: str(),
  employeeId: str(),
  employeeName: str(),
  designation: str(),
  email: str(),
  currentOwner: str(),
  previousOwner: str(),
  status: z.enum(ASSET_STATUSES).optional(),
  condition: str(),
  conditionNotes: str(),
  approvalStatus: str(),
  repairHistory: str(),
  notes: str(),
  // Real per-field validation (required-ness, type, select options) happens server-side in
  // validateCustomFieldValues, not here - this just needs to not strip or reject the field.
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const updateAssetSchema = createAssetSchema.partial();

export const listAssetsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().max(100).optional(),
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

export const bulkDeleteAssetsSchema = z.object({
  ids: z.array(objectId).min(1, "Select at least one asset"),
});

export const assetDocumentParamsSchema = z.object({
  id: z.string().min(1),
  docId: z.string().min(1),
});

export const uploadAssetDocumentBodySchema = z.object({
  type: z.enum(ASSET_DOCUMENT_TYPES).optional().default("Other"),
});

const mappedAssetImportRowSchema = z.object({
  assetIdRaw: importStr(),
  name: importStr(),
  assetType: importStr(),
  deviceType: importStr(),
  manufacturer: importStr(),
  model: importStr(),
  serialNumber: importStr(),
  imei: importStr(),
  color: importStr(),
  processor: importStr(),
  laptopGeneration: importStr(),
  graphicsCard: importStr(),
  ram: importStr(),
  storage: importStr(),
  macAddress: importStr(),
  adapterSerialNumber: importStr(),
  miscAccessories: importStr(),
  operatingSystem: importStr(),
  operatingSystemLicense: importStr(),
  canvaLicense: importStr(),
  hostname: importStr(),
  adMember: importStr(),
  antivirusInstalled: importStr(),
  remoteSoftware: importStr(),
  emailLicense: importStr(),
  microsoftOffice: importStr(),
  microsoftProject: importStr(),
  powerBi: importStr(),
  autoCad: importStr(),
  zwCad: importStr(),
  photoshop: importStr(),
  creativeCloudPro: importStr(),
  illustrator: importStr(),
  acrobatPro: importStr(),
  sketchUpPro: importStr(),
  rocketReachPro: importStr(),
  d5Render: importStr(),
  zoomLicense: importStr(),
  sharedFolderAccess: importStr(),
  status: importStr(),
  condition: importStr(),
  conditionNotes: importStr(),
  approvalStatus: importStr(),
  repairHistory: importStr(),
  purchaseDate: importStr(),
  purchaseCost: importStr(),
  quantity: importStr(),
  warrantyEnd: importStr(),
  invoiceNumber: importStr(),
  companyName: importStr(),
  notes: importStr(),
  categoryName: importStr(),
  locationName: importStr(),
  subLocation: importStr(),
  departmentName: importStr(),
  vendorName: importStr(),
  employeeName: importStr(),
  employeeId: importStr(),
  designation: importStr(),
  email: importStr(),
  userAccessLevel: importStr(),
  currentOwner: importStr(),
  previousOwner: importStr(),
});

export const confirmAssetImportSchema = z.object({
  rows: z
    .array(
      z.object({
        rowIndex: z.number().int(),
        mapped: mappedAssetImportRowSchema,
        classification: z.enum(["new", "updated", "duplicate", "invalid"]),
        reason: z.string().max(500).optional(),
        existingId: z.string().optional(),
        existingAssetId: z.string().optional(),
        changedFields: z.array(z.string()).optional(),
      })
    )
    .max(2000),
});
