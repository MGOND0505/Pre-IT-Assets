import { Schema, model } from "mongoose";

export interface ILicenseCategory {
  name: string;
  description: string;
  status: "Active" | "Inactive";
}

const licenseCategorySchema = new Schema<ILicenseCategory>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

export const LicenseCategory = model<ILicenseCategory>("LicenseCategory", licenseCategorySchema);
