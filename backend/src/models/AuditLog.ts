import { Schema, model, type Types } from "mongoose";

export interface IAuditLog {
  organization: Types.ObjectId | null;
  user: Types.ObjectId | null;
  userSnapshot: { name: string | null; email: string | null; role: string | null };
  action: string;
  module: string;
  recordId: Types.ObjectId | string | null;
  recordLabel: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  userAgent: string | null;
  // Added by the schema's `timestamps: { createdAt: true }` option below - declared here just
  // so TypeScript knows it exists on a hydrated document (Organization/Ticket/etc. use a custom
  // `createdDate` name instead; this model kept Mongoose's default, so the field really is
  // named `createdAt`, not fabricated).
  createdAt: Date;
}

const auditLogSchema = new Schema<IAuditLog>(
  {
    // Nullable: a handful of auth-flow actions (login lockouts, password changes) happen on
    // the flat, org-agnostic /api/auth/* routes, where there's no per-request resolved org -
    // see logAction()'s fallback to the acting user's own home org (still null for superAdmin).
    organization: { type: Schema.Types.ObjectId, ref: "Organization", default: null, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", default: null },
    userSnapshot: {
      name: { type: String, default: null },
      email: { type: String, default: null },
      role: { type: String, default: null },
    },
    action: { type: String, required: true },
    module: { type: String, required: true, index: true },
    recordId: { type: Schema.Types.Mixed, default: null, index: true },
    recordLabel: { type: String, default: null },
    oldValue: { type: Schema.Types.Mixed, default: null },
    newValue: { type: Schema.Types.Mixed, default: null },
    ipAddress: { type: String, default: null },
    userAgent: { type: String, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ module: 1, createdAt: -1 });
auditLogSchema.index({ organization: 1, createdAt: -1 });

// Defense in depth: audit logs are never mutated or deleted via Mongoose, even by internal code.
for (const op of ["findOneAndUpdate", "updateOne", "updateMany", "deleteOne", "deleteMany", "findOneAndDelete"] as const) {
  auditLogSchema.pre(op, function (next) {
    next(new Error("AuditLog documents are immutable"));
  });
}

export const AuditLog = model<IAuditLog>("AuditLog", auditLogSchema);
