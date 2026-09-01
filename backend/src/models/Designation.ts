import { Schema, model, type Types } from "mongoose";

/** A managed, org-scoped list of job designations - mirrors Department in every way (same shape,
 * same soft-delete/recycle-bin treatment). Replaces User.designation's old free-text string (see
 * scripts/migrateDesignations.ts for the one-time conversion of existing values into records
 * here). */
export interface IDesignation {
  organization: Types.ObjectId;
  name: string;
  description: string;
  status: "Active" | "Inactive";
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}

const designationSchema = new Schema<IDesignation>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

designationSchema.index({ organization: 1, name: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

export const Designation = model<IDesignation>("Designation", designationSchema);
