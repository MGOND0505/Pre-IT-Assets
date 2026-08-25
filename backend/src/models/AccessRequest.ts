import { Schema, model, type Types } from "mongoose";
import { emptyPermissions, type PermissionsShape } from "../config/permissions";
import { permissionsSchemaDefinition } from "./User";

export interface IAccessRequest {
  subSuperAdmin: Types.ObjectId;
  organization: Types.ObjectId;
  requestedPermissions: PermissionsShape;
  reason: string;
  status: "Pending" | "Approved" | "Denied";
  decidedBy: Types.ObjectId | null;
  decidedAt: Date | null;
}

const accessRequestSchema = new Schema<IAccessRequest>(
  {
    subSuperAdmin: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    requestedPermissions: { type: permissionsSchemaDefinition, default: emptyPermissions },
    reason: { type: String, default: "", trim: true },
    status: { type: String, enum: ["Pending", "Approved", "Denied"], default: "Pending", index: true },
    decidedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

export const AccessRequest = model<IAccessRequest>("AccessRequest", accessRequestSchema);
