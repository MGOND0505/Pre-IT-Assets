import { Schema, model, type Types } from "mongoose";

export interface IAssetAssignment {
  asset: Types.ObjectId;
  assignedTo: Types.ObjectId | null;
  department: Types.ObjectId | null;
  location: Types.ObjectId | null;
  assignedDate: Date;
  assignedBy: Types.ObjectId | null;
  remarks: string;
  returnedDate: Date | null;
  returnRemarks: string;
}

const assetAssignmentSchema = new Schema<IAssetAssignment>(
  {
    asset: { type: Schema.Types.ObjectId, ref: "Asset", required: true, index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", default: null },
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    location: { type: Schema.Types.ObjectId, ref: "Location", default: null },
    assignedDate: { type: Date, required: true, default: () => new Date() },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    remarks: { type: String, default: "" },
    returnedDate: { type: Date, default: null, index: true },
    returnRemarks: { type: String, default: "" },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

export const AssetAssignment = model<IAssetAssignment>("AssetAssignment", assetAssignmentSchema);
