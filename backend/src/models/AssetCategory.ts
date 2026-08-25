import { Schema, model, type Types } from "mongoose";

export interface IAssetCategory {
  organization: Types.ObjectId;
  name: string;
  prefix: string;
  description: string;
  nextSequence: number;
  status: "Active" | "Inactive";
}

const assetCategorySchema = new Schema<IAssetCategory>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    prefix: {
      type: String,
      required: true,
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

assetCategorySchema.index({ organization: 1, name: 1 }, { unique: true });
assetCategorySchema.index({ organization: 1, prefix: 1 }, { unique: true });

export const AssetCategory = model<IAssetCategory>("AssetCategory", assetCategorySchema);
