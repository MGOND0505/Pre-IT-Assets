import { Schema, model, type Types } from "mongoose";

export const LICENSE_TYPES = [
  "Subscription",
  "Per User",
  "Per Device",
  "Perpetual",
  "Volume License",
  "Trial",
] as const;
export type LicenseType = (typeof LICENSE_TYPES)[number];

export const LICENSE_STATUSES = ["Active", "Expired", "Cancelled"] as const;
export type LicenseStatus = (typeof LICENSE_STATUSES)[number];

export interface ILicense {
  organization: Types.ObjectId;
  licenseId: string;
  softwareName: string;
  productName: string;
  publisher: string;
  category: Types.ObjectId | null;
  licenseType: LicenseType;
  vendor: Types.ObjectId | null;
  purchaseDate: Date | null;
  startDate: Date | null;
  expiryDate: Date | null;
  renewalDate: Date | null;
  totalLicenses: number;
  assignedUsers: Types.ObjectId[];
  costPerLicense: number | null;
  totalCost: number | null;
  department: Types.ObjectId | null;
  status: LicenseStatus;
  poNumber: string;
  invoiceNumber: string;
  notes: string;
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
  createdBy: Types.ObjectId | null;
}

const licenseSchema = new Schema<ILicense>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    licenseId: { type: String, required: true },
    softwareName: { type: String, required: true, trim: true },
    productName: { type: String, default: "" },
    publisher: { type: String, default: "" },
    category: { type: Schema.Types.ObjectId, ref: "LicenseCategory", default: null },
    licenseType: { type: String, enum: LICENSE_TYPES, default: "Subscription" },
    vendor: { type: Schema.Types.ObjectId, ref: "Vendor", default: null },
    purchaseDate: { type: Date, default: null },
    startDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null, index: true },
    renewalDate: { type: Date, default: null },
    totalLicenses: { type: Number, default: 1, min: 1 },
    assignedUsers: [{ type: Schema.Types.ObjectId, ref: "User" }],
    costPerLicense: { type: Number, default: null },
    totalCost: { type: Number, default: null },
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    status: { type: String, enum: LICENSE_STATUSES, default: "Active", index: true },
    poNumber: { type: String, default: "" },
    invoiceNumber: { type: String, default: "" },
    notes: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

licenseSchema.index({ organization: 1, licenseId: 1 }, { unique: true });

export const License = model<ILicense>("License", licenseSchema);
