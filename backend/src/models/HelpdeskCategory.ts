import { Schema, model, type Types } from "mongoose";

export interface IHelpdeskCategory {
  organization: Types.ObjectId;
  name: string;
  description: string;
  // The agent new tickets in this category auto-assign to at creation time - see
  // helpdesk.service.ts#createTicket. Falls back to that agent's own backupAgent if they're on
  // leave; never blocks ticket creation if neither is available.
  defaultAgent: Types.ObjectId | null;
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
    defaultAgent: { type: Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

helpdeskCategorySchema.index({ organization: 1, name: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

export const HelpdeskCategory = model<IHelpdeskCategory>("HelpdeskCategory", helpdeskCategorySchema);
