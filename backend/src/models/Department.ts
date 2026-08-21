import { Schema, model } from "mongoose";

export interface IDepartment {
  name: string;
  description: string;
  status: "Active" | "Inactive";
}

const departmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

export const Department = model<IDepartment>("Department", departmentSchema);
