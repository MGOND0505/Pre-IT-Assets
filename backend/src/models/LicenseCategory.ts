import { Schema, model, type Types } from "mongoose";

export interface ILicenseCategory {
  organization: Types.ObjectId;
  name: string;
  description: string;
  status: "Active" | "Inactive";
}

const licenseCategorySchema = new Schema<ILicenseCategory>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

licenseCategorySchema.index({ organization: 1, name: 1 }, { unique: true });

export const LicenseCategory = model<ILicenseCategory>("LicenseCategory", licenseCategorySchema);
