import { Schema, model, type Types } from "mongoose";

export interface IAssetTransfer {
  asset: Types.ObjectId;
  fromUser: Types.ObjectId | null;
  toUser: Types.ObjectId | null;
  fromLocation: Types.ObjectId | null;
  toLocation: Types.ObjectId | null;
  fromDepartment: Types.ObjectId | null;
  toDepartment: Types.ObjectId | null;
  transferDate: Date;
  reason: string;
  approvedBy: Types.ObjectId | null;
  remarks: string;
  performedBy: Types.ObjectId | null;
}

const assetTransferSchema = new Schema<IAssetTransfer>(
  {
    asset: { type: Schema.Types.ObjectId, ref: "Asset", required: true, index: true },
    fromUser: { type: Schema.Types.ObjectId, ref: "User", default: null },
    toUser: { type: Schema.Types.ObjectId, ref: "User", default: null },
    fromLocation: { type: Schema.Types.ObjectId, ref: "Location", default: null },
    toLocation: { type: Schema.Types.ObjectId, ref: "Location", default: null },
    fromDepartment: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    toDepartment: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    transferDate: { type: Date, required: true, default: () => new Date() },
    reason: { type: String, default: "" },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    remarks: { type: String, default: "" },
    performedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: false } }
);

export const AssetTransfer = model<IAssetTransfer>("AssetTransfer", assetTransferSchema);
