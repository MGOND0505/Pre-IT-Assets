import { Schema, model, type Types } from "mongoose";

export const ASSET_HISTORY_ACTIONS = [
  "Created",
  "Assigned",
  "Reassigned",
  "Transferred",
  "Returned",
  "Retired",
  "Updated",
] as const;

export type AssetHistoryAction = (typeof ASSET_HISTORY_ACTIONS)[number];

export interface IAssetHistory {
  asset: Types.ObjectId;
  action: AssetHistoryAction;
  user: Types.ObjectId | null;
  previousValue: unknown;
  newValue: unknown;
  remarks: string;
}

const assetHistorySchema = new Schema<IAssetHistory>(
  {
    asset: { type: Schema.Types.ObjectId, ref: "Asset", required: true, index: true },
    action: { type: String, enum: ASSET_HISTORY_ACTIONS, required: true },
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
    previousValue: { type: Schema.Types.Mixed, default: null },
    newValue: { type: Schema.Types.Mixed, default: null },
    remarks: { type: String, default: "" },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

assetHistorySchema.index({ asset: 1, createdAt: -1 });

export const AssetHistory = model<IAssetHistory>("AssetHistory", assetHistorySchema);
