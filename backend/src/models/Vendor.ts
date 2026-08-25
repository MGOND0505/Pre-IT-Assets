import { Schema, model, type Types } from "mongoose";

export interface IVendor {
  organization: Types.ObjectId;
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  service: string;
  address: string;
  contractStart: Date | null;
  contractEnd: Date | null;
  status: "Active" | "Inactive";
  notes: string;
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}

const vendorSchema = new Schema<IVendor>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, default: "" },
    email: { type: String, default: "", trim: true, lowercase: true },
    phone: { type: String, default: "" },
    service: { type: String, default: "" },
    address: { type: String, default: "" },
    contractStart: { type: Date, default: null },
    contractEnd: { type: Date, default: null },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    notes: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

vendorSchema.index({ organization: 1, name: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

export const Vendor = model<IVendor>("Vendor", vendorSchema);
