import { Schema, model, type HydratedDocument, type Types } from "mongoose";

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  roles: Types.ObjectId[];
  department: Types.ObjectId | null;
  designation?: string;
  phone?: string;
  status: "Active" | "Inactive";
  mustChangePassword: boolean;
  tokenVersion: number;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdBy: Types.ObjectId | null;
}

export type UserDoc = HydratedDocument<IUser>;

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"],
    },
    passwordHash: { type: String, required: true, select: false },
    roles: [{ type: Schema.Types.ObjectId, ref: "Role", required: true }],
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    designation: { type: String, trim: true },
    phone: { type: String, trim: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active", index: true },
    mustChangePassword: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" },
    toJSON: {
      transform(_doc, ret) {
        delete (ret as Record<string, unknown>).passwordHash;
        delete (ret as Record<string, unknown>).passwordResetTokenHash;
        delete (ret as Record<string, unknown>).passwordResetExpires;
        return ret;
      },
    },
  }
);

export const User = model<IUser>("User", userSchema);
