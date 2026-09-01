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

export interface IAsset {
  organization: Types.ObjectId;
  assetId: string;
  name: string;
  category: Types.ObjectId;
  assetType: string;
  deviceType: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  serviceTag: string;
  imei: string;
  color: string;
  hostname: string;
  ipAddress: string;
  macAddress: string;
  operatingSystem: string;
  operatingSystemLicense: string;
  configuration: string;
  processor: string;
  laptopGeneration: string;
  graphicsCard: string;
  ram: string;
  storage: string;
  adapterSerialNumber: string;
  miscAccessories: string;
  adMember: string;
  antivirusInstalled: string;
  remoteSoftware: string;
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
  companyName: string;
  poNumber: string;
  invoiceNumber: string;
  warrantyStart: Date | null;
  warrantyEnd: Date | null;
  amcStart: Date | null;
  amcEnd: Date | null;
  location: Types.ObjectId | null;
  subLocation: string;
  department: Types.ObjectId | null;
  assignedUser: Types.ObjectId | null;
  userAccessLevel: string;
  employeeId: string;
  employeeName: string;
  designation: string;
  email: string;
  currentOwner: string;
  previousOwner: string;
  status: AssetStatus;
  condition: string;
  conditionNotes: string;
  approvalStatus: string;
  repairHistory: string;
  notes: string;
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
    name: { type: String, required: true, trim: true },
    category: { type: Schema.Types.ObjectId, ref: "AssetCategory", required: true },
    assetType: { type: String, default: "" },
    deviceType: { type: String, default: "" },
    manufacturer: { type: String, default: "" },
    model: { type: String, default: "" },
    serialNumber: { type: String, default: "", index: true },
    serviceTag: { type: String, default: "", index: true },
    imei: { type: String, default: "", index: true },
    color: { type: String, default: "" },
    hostname: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
    macAddress: { type: String, default: "" },
    operatingSystem: { type: String, default: "" },
    operatingSystemLicense: { type: String, default: "" },
    configuration: { type: String, default: "" },
    processor: { type: String, default: "" },
    laptopGeneration: { type: String, default: "" },
    graphicsCard: { type: String, default: "" },
    ram: { type: String, default: "" },
    storage: { type: String, default: "" },
    adapterSerialNumber: { type: String, default: "" },
    miscAccessories: { type: String, default: "" },
    adMember: { type: String, default: "" },
    antivirusInstalled: { type: String, default: "" },
    remoteSoftware: { type: String, default: "" },
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
    companyName: { type: String, default: "" },
    poNumber: { type: String, default: "" },
    invoiceNumber: { type: String, default: "" },
    warrantyStart: { type: Date, default: null },
    warrantyEnd: { type: Date, default: null },
    amcStart: { type: Date, default: null },
    amcEnd: { type: Date, default: null },
    location: { type: Schema.Types.ObjectId, ref: "Location", default: null, index: true },
    subLocation: { type: String, default: "" },
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null, index: true },
    assignedUser: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    userAccessLevel: { type: String, default: "" },
    employeeId: { type: String, default: "", index: true },
    employeeName: { type: String, default: "" },
    designation: { type: String, default: "" },
    email: { type: String, default: "" },
    currentOwner: { type: String, default: "" },
    previousOwner: { type: String, default: "" },
    status: { type: String, enum: ASSET_STATUSES, default: "In Stock", index: true },
    condition: { type: String, default: "" },
    conditionNotes: { type: String, default: "" },
    approvalStatus: { type: String, default: "" },
    repairHistory: { type: String, default: "" },
    notes: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    customFields: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

assetSchema.index({ organization: 1, assetId: 1 }, { unique: true });

export const Asset = model<IAsset>("Asset", assetSchema);
