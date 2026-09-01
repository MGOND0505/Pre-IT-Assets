import { Schema, model, type Types } from "mongoose";

export const ASSET_DOCUMENT_TYPES = ["Invoice", "Warranty", "AMC", "Purchase", "Other"] as const;
export type AssetDocumentType = (typeof ASSET_DOCUMENT_TYPES)[number];

export interface IAssetDocument {
  asset: Types.ObjectId;
  organization: Types.ObjectId;
  type: AssetDocumentType;
  originalName: string;
  storedFileName: string;
  mimeType: string;
  size: number;
  uploadedBy: Types.ObjectId | null;
}

const assetDocumentSchema = new Schema<IAssetDocument>(
  {
    asset: { type: Schema.Types.ObjectId, ref: "Asset", required: true, index: true },
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    type: { type: String, enum: ASSET_DOCUMENT_TYPES, default: "Other" },
    originalName: { type: String, required: true },
    storedFileName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: false } }
);

export const AssetDocument = model<IAssetDocument>("AssetDocument", assetDocumentSchema);
