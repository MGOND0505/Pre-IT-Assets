import { Schema, model } from "mongoose";

export interface IAssetCategory {
  name: string;
  prefix: string;
  description: string;
  nextSequence: number;
  status: "Active" | "Inactive";
}

const assetCategorySchema = new Schema<IAssetCategory>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    prefix: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z0-9]{2,6}$/, "Prefix must be 2-6 letters/digits"],
    },
    description: { type: String, default: "" },
    nextSequence: { type: Number, default: 1 },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

export const AssetCategory = model<IAssetCategory>("AssetCategory", assetCategorySchema);
