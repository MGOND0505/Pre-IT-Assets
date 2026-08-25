import { Schema, model, type Types } from "mongoose";
import { ENTITLEMENT_MODULES, type EntitlementModule } from "../config/permissions";

export interface IOrganization {
  name: string;
  slug: string;
  code: string | null;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  status: "Active" | "Inactive";
  enabledModules: EntitlementModule[];
  validFrom: Date | null;
  validUntil: Date | null;
  gracePeriodDays: number;
  // Governs how long soft-deleted DATA WITHIN this org (Vendors, Users, Tickets, ...) stays
  // restorable before dataRetentionScheduler.ts permanently purges it - distinct from
  // ORG_RECYCLE_BIN_RETENTION_DAYS (organizations.service.ts), the fixed 90-day window for a
  // DELETED ORGANIZATION itself. System-level governance only (Super Admin / Sub-Super Admin) -
  // that org's own Org Admin/Team Members cannot change this, same as gracePeriodDays.
  recycleBinRetentionDays: number;
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}

const organizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug must be lowercase letters, numbers, and single hyphens only"],
    },
    code: { type: String, trim: true, default: null },
    email: { type: String, default: "", trim: true, lowercase: true },
    phone: { type: String, default: "" },
    addressLine1: { type: String, default: "" },
    addressLine2: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    country: { type: String, default: "" },
    postalCode: { type: String, default: "" },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active", index: true },
    enabledModules: { type: [String], enum: ENTITLEMENT_MODULES, default: () => [...ENTITLEMENT_MODULES] },
    validFrom: { type: Date, default: null },
    validUntil: { type: Date, default: null },
    gracePeriodDays: { type: Number, default: 7 },
    recycleBinRetentionDays: { type: Number, default: 30, min: 30, max: 180 },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

// A deleted organization's slug/code shouldn't block a new org (or a dedupe-suffixed retry)
// from reusing it - so uniqueness is only enforced among LIVE orgs, same pattern as User's
// email/employeeId indexes.
organizationSchema.index({ slug: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });
organizationSchema.index(
  { code: 1 },
  { unique: true, partialFilterExpression: { code: { $exists: true, $type: "string" }, isDeleted: false } }
);

export const Organization = model<IOrganization>("Organization", organizationSchema);
