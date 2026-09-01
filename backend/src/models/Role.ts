import { Schema, model, type Types } from "mongoose";
import { emptyPermissions, type PermissionsShape } from "../config/permissions";
import { permissionsSchemaDefinition } from "./User";

export const ROLE_PORTAL_TYPES = ["subAdmin", "employee"] as const;
export type RolePortalType = (typeof ROLE_PORTAL_TYPES)[number];

/** A named, reusable permission template an org Admin defines once and applies to many users -
 * e.g. "Helpdesk Manager", "Asset Auditor". Applying a Role COPIES its `portalType`/`permissions`
 * onto a user at that moment (see users.service.ts#createUser/updateUserPermissions) - this is a
 * convenience/reuse layer OVER the existing granular permission matrix, never a second
 * authorization axis. Editing a Role afterwards does NOT retroactively change already-assigned
 * users. Mirrors Designation/CustomFieldDefinition in every structural way (same soft-delete/
 * recycle-bin treatment). */
export interface IRole {
  organization: Types.ObjectId;
  name: string;
  description: string;
  // Which of the two non-admin dashboard/nav experiences an assignee of this Role gets - reuses
  // User.employeeTier's existing "subAdmin" | "employee" values unchanged. Never "admin" - a Role
  // is only ever a template for a non-admin account.
  portalType: RolePortalType;
  permissions: PermissionsShape;
  status: "Active" | "Inactive";
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}

const roleSchema = new Schema<IRole>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    portalType: { type: String, enum: ROLE_PORTAL_TYPES, required: true },
    permissions: { type: permissionsSchemaDefinition, default: emptyPermissions },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

roleSchema.index({ organization: 1, name: 1 }, { unique: true, partialFilterExpression: { isDeleted: false } });

export const Role = model<IRole>("Role", roleSchema);
