import { Schema, model } from "mongoose";

export interface ILocation {
  name: string;
  address: string;
  city: string;
  state: string;
  country: string;
  status: "Active" | "Inactive";
}

const locationSchema = new Schema<ILocation>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    address: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

export const Location = model<ILocation>("Location", locationSchema);
