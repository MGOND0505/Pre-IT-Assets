import { Schema, model } from "mongoose";

export interface IVendor {
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
}

const vendorSchema = new Schema<IVendor>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    contactPerson: { type: String, default: "" },
    email: { type: String, default: "", trim: true, lowercase: true },
    phone: { type: String, default: "" },
    service: { type: String, default: "" },
    address: { type: String, default: "" },
    contractStart: { type: Date, default: null },
    contractEnd: { type: Date, default: null },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    notes: { type: String, default: "" },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

export const Vendor = model<IVendor>("Vendor", vendorSchema);
