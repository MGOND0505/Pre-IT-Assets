import { Schema, model, type Types } from "mongoose";

export interface IHelpdeskPriority {
  organization: Types.ObjectId;
  name: string;
  order: number;
  color: string;
  slaResponseMinutes: number;
  slaResolutionMinutes: number;
  status: "Active" | "Inactive";
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}

const helpdeskPrioritySchema = new Schema<IHelpdeskPriority>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    // Lower = more urgent - drives default sort order in the priority dropdown/list.
    order: { type: Number, default: 0 },
    color: { type: String, default: "#0080F0" },
    slaResponseMinutes: { type: Number, required: true, min: 1 },
    slaResolutionMinutes: { type: Number, required: true, min: 1 },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

helpdeskPrioritySchema.index({ organization: 1, name: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

export const HelpdeskPriority = model<IHelpdeskPriority>("HelpdeskPriority", helpdeskPrioritySchema);
