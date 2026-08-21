import { Schema, model, type Types } from "mongoose";

export interface IRole {
  name: string;
  description: string;
  isSystem: boolean;
  isSuperAdmin: boolean;
  permissions: Types.ObjectId[];
}

const roleSchema = new Schema<IRole>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, default: "" },
    isSystem: { type: Boolean, default: false },
    isSuperAdmin: { type: Boolean, default: false },
    permissions: [{ type: Schema.Types.ObjectId, ref: "Permission" }],
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

export const Role = model<IRole>("Role", roleSchema);
