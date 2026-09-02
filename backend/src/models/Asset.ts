import { Schema, model, type Types } from "mongoose";

export const ASSET_STATUSES = [
  "In Stock",
  "Available",
  "Assigned",
  "Reserved",
  "Under Repair",
  "Under Maintenance",
  "Lost",
  "Stolen",
  "Damaged",
  "Retired",
  "Disposed",
] as const;

export type AssetStatus = (typeof ASSET_STATUSES)[number];

// Deliberately a distinct field from the pre-existing `assetType` (a free-text field that
// doubles as an asset-category-name fallback during bulk import, e.g. "Laptop"/"Desktop" - see
// assets.import.ts#mapRow) - reusing that field/label for "Own vs Rental" would silently repurpose
// real existing data for every asset already imported through it.
// "Lease" added alongside the original "Own"/"Rental" per the enterprise ITAM spec - a pure
// enum extension, existing "Own"/"Rental" data and behavior is unaffected.
export const ASSET_OWNERSHIP_TYPES = ["Own", "Rental", "Lease"] as const;
export type AssetOwnershipType = (typeof ASSET_OWNERSHIP_TYPES)[number];

export const ASSET_CRITICALITY_LEVELS = ["Low", "Medium", "High", "Critical"] as const;
export type AssetCriticality = (typeof ASSET_CRITICALITY_LEVELS)[number];

// How this asset is currently held - consolidates the enterprise-ITAM spec's separate
// "assignment type" concept (Employee/Shared/Pool/etc.) into the single approved
// `assignmentStatus` field name rather than adding a second parallel field.
export const ASSET_ASSIGNMENT_STATUSES = ["Unassigned", "Assigned", "Shared", "Pool", "Temporary"] as const;
export type AssetAssignmentStatus = (typeof ASSET_ASSIGNMENT_STATUSES)[number];

export const ASSET_DEPRECIATION_METHODS = ["Straight-Line", "None"] as const;
export type AssetDepreciationMethod = (typeof ASSET_DEPRECIATION_METHODS)[number];

export const ASSET_ANTIVIRUS_STATUSES = ["Installed", "Not Installed", "Outdated", "Unknown"] as const;
export type AssetAntivirusStatus = (typeof ASSET_ANTIVIRUS_STATUSES)[number];

export interface IAsset {
  organization: Types.ObjectId;
  assetId: string;
  // A unique physical tag/barcode/QR code identifier - distinct from `assetId` (the system-
  // generated identifier, always present) since a physical tag may be applied later, replaced if
  // damaged, or never used by orgs that don't physically label assets. "" (default) = not set;
  // uniqueness is enforced only for non-blank values (see the partial index below) so blank
  // assets never collide with each other.
  assetTag: string;
  name: string;
  category: Types.ObjectId;
  assetType: string;
  // Finer-grained classification within `assetType`/`category` (e.g. category "Laptop", assetType
  // "Ultrabook", assetSubType "Business" vs "Gaming") - purely descriptive, no enum, since the
  // valid values are entirely org/category-dependent.
  assetSubType: string;
  ownershipType: AssetOwnershipType;
  // How much business impact this asset's unavailability would cause - drives dashboard
  // prioritization and (later phases) maintenance/audit urgency, not any access-control decision.
  criticality: AssetCriticality;
  companyEntity: string;
  description: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  hostname: string;
  ipAddress: string;
  macAddress: string;
  operatingSystem: string;
  // Free-text version/edition detail parsed out of the legacy operatingSystem blob where it could
  // be split with confidence (e.g. "Windows 11 Pro" -> operatingSystem "Windows", osVersion
  // "11 Pro") - see migrateAssetFieldsPhase3.ts. Never guessed: an unparseable original value
  // stays whole in operatingSystem with this left blank.
  osVersion: string;
  operatingSystemLicense: string;
  CPU: string;
  GPU: string;
  ram: string;
  storage: string;
  display: string;
  biosUefiVersion: string;
  deviceUUID: string;
  adapterSerialNumber: string;
  directoryMembership: string;
  domainName: string;
  encryptionStatus: string;
  securityAgentStatus: string;
  antivirusStatus: AssetAntivirusStatus;
  patchStatus: string;
  complianceStatus: string;
  lastSecurityCheck: Date | null;
  emailLicense: string;
  canvaLicense: string;
  microsoftOffice: string;
  microsoftProject: string;
  powerBi: string;
  autoCad: string;
  zwCad: string;
  photoshop: string;
  creativeCloudPro: string;
  illustrator: string;
  acrobatPro: string;
  sketchUpPro: string;
  rocketReachPro: string;
  d5Render: string;
  zoomLicense: string;
  sharedFolderAccess: string;
  purchaseDate: Date | null;
  purchaseCost: number | null;
  quantity: number | null;
  vendor: Types.ObjectId | null;
  purchaseOrderNumber: string;
  invoiceNumber: string;
  currency: string;
  contractNumber: string;
  costCenter: string;
  budgetCode: string;
  depreciationMethod: AssetDepreciationMethod;
  depreciationStartDate: Date | null;
  warrantyStartDate: Date | null;
  warrantyEndDate: Date | null;
  warrantyProvider: string;
  supportContract: string;
  contractStartDate: Date | null;
  contractEndDate: Date | null;
  location: Types.ObjectId | null;
  building: string;
  floor: string;
  room: string;
  subLocation: string;
  department: Types.ObjectId | null;
  assignedUser: Types.ObjectId | null;
  assignmentDate: Date | null;
  returnDate: Date | null;
  assignmentStatus: AssetAssignmentStatus;
  status: AssetStatus;
  condition: string;
  repairHistory: string;
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
  createdBy: Types.ObjectId | null;
  /** Org-defined extra fields (see CustomFieldDefinition) keyed by each definition's `key`.
   * Additive/optional - absent or missing keys just means no value was ever set for that field. */
  customFields: Record<string, unknown>;
}

const assetSchema = new Schema<IAsset>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    assetId: { type: String, required: true },
    assetTag: { type: String, default: "" },
    name: { type: String, required: true, trim: true },
    category: { type: Schema.Types.ObjectId, ref: "AssetCategory", required: true },
    assetType: { type: String, default: "" },
    assetSubType: { type: String, default: "" },
    ownershipType: { type: String, enum: ASSET_OWNERSHIP_TYPES, default: "Own", index: true },
    criticality: { type: String, enum: ASSET_CRITICALITY_LEVELS, default: "Medium", index: true },
    companyEntity: { type: String, default: "" },
    description: { type: String, default: "" },
    manufacturer: { type: String, default: "" },
    model: { type: String, default: "" },
    serialNumber: { type: String, default: "", index: true },
    hostname: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
    macAddress: { type: String, default: "" },
    operatingSystem: { type: String, default: "" },
    osVersion: { type: String, default: "" },
    operatingSystemLicense: { type: String, default: "" },
    CPU: { type: String, default: "" },
    GPU: { type: String, default: "" },
    ram: { type: String, default: "" },
    storage: { type: String, default: "" },
    display: { type: String, default: "" },
    biosUefiVersion: { type: String, default: "" },
    deviceUUID: { type: String, default: "" },
    adapterSerialNumber: { type: String, default: "" },
    directoryMembership: { type: String, default: "" },
    domainName: { type: String, default: "" },
    encryptionStatus: { type: String, default: "" },
    securityAgentStatus: { type: String, default: "" },
    antivirusStatus: { type: String, enum: ASSET_ANTIVIRUS_STATUSES, default: "Unknown" },
    patchStatus: { type: String, default: "" },
    complianceStatus: { type: String, default: "" },
    lastSecurityCheck: { type: Date, default: null },
    emailLicense: { type: String, default: "" },
    canvaLicense: { type: String, default: "" },
    microsoftOffice: { type: String, default: "" },
    microsoftProject: { type: String, default: "" },
    powerBi: { type: String, default: "" },
    autoCad: { type: String, default: "" },
    zwCad: { type: String, default: "" },
    photoshop: { type: String, default: "" },
    creativeCloudPro: { type: String, default: "" },
    illustrator: { type: String, default: "" },
    acrobatPro: { type: String, default: "" },
    sketchUpPro: { type: String, default: "" },
    rocketReachPro: { type: String, default: "" },
    d5Render: { type: String, default: "" },
    zoomLicense: { type: String, default: "" },
    sharedFolderAccess: { type: String, default: "" },
    purchaseDate: { type: Date, default: null },
    purchaseCost: { type: Number, default: null },
    quantity: { type: Number, default: null },
    vendor: { type: Schema.Types.ObjectId, ref: "Vendor", default: null },
    purchaseOrderNumber: { type: String, default: "" },
    invoiceNumber: { type: String, default: "" },
    currency: { type: String, default: "" },
    contractNumber: { type: String, default: "" },
    costCenter: { type: String, default: "" },
    budgetCode: { type: String, default: "" },
    depreciationMethod: { type: String, enum: ASSET_DEPRECIATION_METHODS, default: "None" },
    depreciationStartDate: { type: Date, default: null },
    warrantyStartDate: { type: Date, default: null },
    warrantyEndDate: { type: Date, default: null },
    warrantyProvider: { type: String, default: "" },
    supportContract: { type: String, default: "" },
    contractStartDate: { type: Date, default: null },
    contractEndDate: { type: Date, default: null },
    location: { type: Schema.Types.ObjectId, ref: "Location", default: null, index: true },
    building: { type: String, default: "" },
    floor: { type: String, default: "" },
    room: { type: String, default: "" },
    subLocation: { type: String, default: "" },
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null, index: true },
    assignedUser: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    assignmentDate: { type: Date, default: null },
    returnDate: { type: Date, default: null },
    assignmentStatus: { type: String, enum: ASSET_ASSIGNMENT_STATUSES, default: "Unassigned", index: true },
    status: { type: String, enum: ASSET_STATUSES, default: "In Stock", index: true },
    condition: { type: String, default: "" },
    repairHistory: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    customFields: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

assetSchema.index({ organization: 1, assetId: 1 }, { unique: true });

// Unique only when non-blank ({$gt: ""} - MongoDB partial filter expressions support $gt/$gte/
// $lt/$lte/$type/$exists/equality, not $ne, so this is the correct way to express "unique when
// set, no constraint when blank" for a string field whose unset default is "" rather than
// undefined - see User.ts's employeeId index for the $exists-based equivalent used where the
// field has no default at all). Confirmed no existing duplicate non-blank values in local dev
// data before adding this so the index actually builds cleanly on an existing collection.
assetSchema.index(
  { organization: 1, assetTag: 1 },
  { unique: true, partialFilterExpression: { assetTag: { $gt: "" }, isDeleted: false } }
);
assetSchema.index(
  { organization: 1, serialNumber: 1 },
  { unique: true, partialFilterExpression: { serialNumber: { $gt: "" }, isDeleted: false } }
);

export const Asset = model<IAsset>("Asset", assetSchema);
