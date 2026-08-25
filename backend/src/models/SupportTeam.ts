import { Schema, model, type Types } from "mongoose";

export type SupportTier = "L1" | "L2" | "L3";

export interface ISupportTeamMember {
  user: Types.ObjectId;
  isActive: boolean;
}

export interface ISupportTeam {
  organization: Types.ObjectId;
  name: string;
  tier: SupportTier;
  // Empty array = matches any ticket for that field - see roundRobin.service.ts#findEligibleTeam.
  categories: Types.ObjectId[];
  departments: Types.ObjectId[];
  locations: Types.ObjectId[];
  members: ISupportTeamMember[];
  // Index into the active-members subset - advanced atomically by pickNextAgent(), never read
  // as a raw index into `members` directly (inactive members are filtered out first).
  roundRobinCursor: number;
  status: "Active" | "Inactive";
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}

const supportTeamSchema = new Schema<ISupportTeam>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    tier: { type: String, enum: ["L1", "L2", "L3"], required: true },
    categories: [{ type: Schema.Types.ObjectId, ref: "HelpdeskCategory" }],
    departments: [{ type: Schema.Types.ObjectId, ref: "Department" }],
    locations: [{ type: Schema.Types.ObjectId, ref: "Location" }],
    members: {
      type: [
        {
          user: { type: Schema.Types.ObjectId, ref: "User", required: true },
          isActive: { type: Boolean, default: true },
        },
      ],
      default: [],
    },
    roundRobinCursor: { type: Number, default: 0 },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

supportTeamSchema.index({ organization: 1, name: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
supportTeamSchema.index({ organization: 1, tier: 1, status: 1 });

export const SupportTeam = model<ISupportTeam>("SupportTeam", supportTeamSchema);
