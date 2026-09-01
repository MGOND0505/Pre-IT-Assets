import { Schema, model, type HydratedDocument, type Types } from "mongoose";
import { emptyPermissions, PERMISSION_MODULES, PERMISSION_ACTIONS, type PermissionsShape } from "../config/permissions";

export type UserRole = "superAdmin" | "subSuperAdmin" | "orgAdmin" | "teamMember";

export interface IOrgAccessGrant {
  organization: Types.ObjectId;
  permissions: PermissionsShape;
}

export interface IUser {
  name: string;
  email: string;
  employeeId?: string;
  passwordHash: string;
  role: UserRole;
  // Derived from `role` (see the virtual below) - nothing is actually stored under this key.
  isAdmin: boolean;
  // null for superAdmin AND subSuperAdmin - every orgAdmin/teamMember must belong to exactly
  // one org; a subSuperAdmin's organizations live in `orgAccess` instead (zero or many).
  organization: Types.ObjectId | null;
  // Only ever populated for role === "subSuperAdmin" - each entry is a complete, independent
  // permission grant for one organization (no isAdmin-style bypass; "Full Access" there is
  // just all flags true). Never read for any other role - see `permissions` below.
  orgAccess: IOrgAccessGrant[];
  // The org-scoped user's own permission set (orgAdmin/teamMember). For subSuperAdmin this
  // field stays permanently emptyPermissions() - enforced below - since their real grants live
  // in `orgAccess`; `resolveOrganization` overrides `req.user.permissions` per-request from
  // there, this stored field is never the source of truth for that role.
  permissions: PermissionsShape;
  department: Types.ObjectId | null;
  location: Types.ObjectId | null;
  designation?: string;
  phone?: string;
  status: "Active" | "Inactive";
  // Helpdesk assignment availability - independent of `status`, which is about account access,
  // not workload. While true, helpdesk.service.ts#assignTicket treats this agent as unavailable
  // for new ticket assignment.
  isOnLeave: boolean;
  backupAgent: Types.ObjectId | null;
  mustChangePassword: boolean;
  tokenVersion: number;
  passwordResetTokenHash?: string;
  passwordResetExpires?: Date;
  // Most-recent-first bcrypt hashes of past passwords, trimmed to the org's (or the baseline's)
  // configured historyLimit at write time - see utils/passwordPolicy.ts.
  passwordHistory: string[];
  passwordChangedAt: Date | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  createdBy: Types.ObjectId | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}

export type UserDoc = HydratedDocument<IUser>;

// Derived from PERMISSION_ACTIONS (config/permissions.ts) rather than hardcoded, so this can
// never again silently drift out of sync with PermissionsShape's own field list - it previously
// only declared the 6 core actions, meaning Mongoose quietly stripped every module-specific one
// (assign, reassign, close, reopen, comment, internalNote, manageAttachments, editAssetId) on
// every save. A field mattering only for certain modules (see MODULE_ACTIONS) still always exists
// here for every module - harmless, since it's simply never read/set for a module that ignores it.
const modulePermissionSchema = Object.fromEntries(
  PERMISSION_ACTIONS.map((action) => [action, { type: Boolean, default: false }])
);

export const permissionsSchemaDefinition = Object.fromEntries(
  PERMISSION_MODULES.map((moduleKey) => [moduleKey, modulePermissionSchema])
);

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Invalid email address"],
    },
    employeeId: { type: String, trim: true, uppercase: true },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ["superAdmin", "subSuperAdmin", "orgAdmin", "teamMember"],
      required: true,
      default: "teamMember",
    },
    organization: { type: Schema.Types.ObjectId, ref: "Organization", default: null },
    orgAccess: {
      type: [
        {
          organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
          permissions: { type: permissionsSchemaDefinition, default: emptyPermissions },
        },
      ],
      default: [],
    },
    permissions: {
      type: permissionsSchemaDefinition,
      default: emptyPermissions,
    },
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    location: { type: Schema.Types.ObjectId, ref: "Location", default: null },
    designation: { type: String, trim: true },
    phone: { type: String, trim: true },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active", index: true },
    isOnLeave: { type: Boolean, default: false },
    backupAgent: { type: Schema.Types.ObjectId, ref: "User", default: null },
    mustChangePassword: { type: Boolean, default: true },
    tokenVersion: { type: Number, default: 0 },
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpires: { type: Date, select: false },
    passwordHistory: { type: [String], default: [], select: false },
    passwordChangedAt: { type: Date, default: null },
    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  {
    timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" },
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        delete (ret as Record<string, unknown>).passwordHash;
        delete (ret as Record<string, unknown>).passwordResetTokenHash;
        delete (ret as Record<string, unknown>).passwordResetExpires;
        delete (ret as Record<string, unknown>).passwordHistory;
        return ret;
      },
    },
    toObject: { virtuals: true },
  }
);

// isAdmin is derived from `role`, never stored - nothing for it to drift out of sync with.
// Bypasses the module/action permission matrix for both org-level and system-level admins,
// but never bypasses the org-ownership check in resolveOrganization - a superAdmin still
// passes through that middleware for every request, they just always pass its comparison.
userSchema.virtual("isAdmin").get(function (this: UserDoc) {
  return this.role === "orgAdmin" || this.role === "superAdmin";
});

userSchema.pre("validate", function (next) {
  const isSystemLevel = this.role === "superAdmin" || this.role === "subSuperAdmin";

  if (isSystemLevel && this.organization) {
    return next(new Error("superAdmin/subSuperAdmin accounts must not belong to an organization"));
  }
  if (!isSystemLevel && !this.organization) {
    return next(new Error("orgAdmin and teamMember accounts must belong to an organization"));
  }

  if (this.role === "subSuperAdmin") {
    // Their real grants live in `orgAccess`, one complete independent permission set per
    // organization (no isAdmin-style bypass) - the top-level `permissions` field is never the
    // source of truth for this role, so keep it inert rather than leaving it silently unused.
    this.permissions = emptyPermissions();

    // Mongo can't enforce uniqueness across elements of one document's array - dedupe here so
    // two grants for the same organization (e.g. from a racy/buggy update) can never coexist.
    const seen = new Set<string>();
    this.orgAccess = this.orgAccess.filter((grant) => {
      const key = String(grant.organization);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  } else if (this.orgAccess.length > 0) {
    this.orgAccess = [];
  }

  next();
});

// email/employeeId are unique PER ORGANIZATION, not globally - except the rare null-org
// superAdmin accounts, which stay globally unique among themselves. Mongo partial unique
// indexes express this cleanly; a unique index can use EITHER `sparse` OR
// `partialFilterExpression`, not both, so "only when present" for employeeId is expressed
// inside the filter itself.
userSchema.index(
  { organization: 1, email: 1 },
  { unique: true, partialFilterExpression: { organization: { $type: "objectId" }, isDeleted: false } }
);
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { organization: null, isDeleted: false } }
);
userSchema.index(
  { organization: 1, employeeId: 1 },
  {
    unique: true,
    partialFilterExpression: { employeeId: { $exists: true }, organization: { $type: "objectId" }, isDeleted: false },
  }
);
userSchema.index(
  { employeeId: 1 },
  { unique: true, partialFilterExpression: { employeeId: { $exists: true }, organization: null, isDeleted: false } }
);

export const User = model<IUser>("User", userSchema);
