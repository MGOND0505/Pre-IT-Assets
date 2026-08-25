import { Schema, model, type Types } from "mongoose";

export interface ILocation {
  organization: Types.ObjectId;
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  status: "Active" | "Inactive";
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}

const locationSchema = new Schema<ILocation>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

locationSchema.index({ organization: 1, name: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

export const Location = model<ILocation>("Location", locationSchema);
