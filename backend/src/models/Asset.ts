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
  assetId: string;
  name: string;
  category: Types.ObjectId;
  assetType: string;
  manufacturer: string;
  model: string;
  serialNumber: string;
  serviceTag: string;
  hostname: string;
  ipAddress: string;
  macAddress: string;
  operatingSystem: string;
  configuration: string;
  purchaseDate: Date | null;
  purchaseCost: number | null;
  vendor: Types.ObjectId | null;
  poNumber: string;
  invoiceNumber: string;
  warrantyStart: Date | null;
  warrantyEnd: Date | null;
  amcStart: Date | null;
  amcEnd: Date | null;
  location: Types.ObjectId | null;
  department: Types.ObjectId | null;
  assignedUser: Types.ObjectId | null;
  status: AssetStatus;
  condition: string;
  notes: string;
  createdBy: Types.ObjectId | null;
}

const assetSchema = new Schema<IAsset>(
  {
    assetId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true },
    category: { type: Schema.Types.ObjectId, ref: "AssetCategory", required: true },
    assetType: { type: String, default: "" },
    manufacturer: { type: String, default: "" },
    model: { type: String, default: "" },
    serialNumber: { type: String, default: "", index: true },
    serviceTag: { type: String, default: "", index: true },
    hostname: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
    macAddress: { type: String, default: "" },
    operatingSystem: { type: String, default: "" },
    configuration: { type: String, default: "" },
    purchaseDate: { type: Date, default: null },
    purchaseCost: { type: Number, default: null },
    vendor: { type: Schema.Types.ObjectId, ref: "Vendor", default: null },
    poNumber: { type: String, default: "" },
    invoiceNumber: { type: String, default: "" },
    warrantyStart: { type: Date, default: null },
    warrantyEnd: { type: Date, default: null },
    amcStart: { type: Date, default: null },
    amcEnd: { type: Date, default: null },
    location: { type: Schema.Types.ObjectId, ref: "Location", default: null, index: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null, index: true },
    assignedUser: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },
    status: { type: String, enum: ASSET_STATUSES, default: "In Stock", index: true },
    condition: { type: String, default: "" },
    notes: { type: String, default: "" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

export const Asset = model<IAsset>("Asset", assetSchema);
