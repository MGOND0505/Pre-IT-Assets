import { Schema, model, type Types } from "mongoose";

export interface IHelpdeskCategory {
  organization: Types.ObjectId;
  name: string;
  description: string;
  status: "Active" | "Inactive";
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}

const helpdeskCategorySchema = new Schema<IHelpdeskCategory>(
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

helpdeskCategorySchema.index({ organization: 1, name: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

export const HelpdeskCategory = model<IHelpdeskCategory>("HelpdeskCategory", helpdeskCategorySchema);
