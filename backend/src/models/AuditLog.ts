import { Schema, model, type Types } from "mongoose";

export interface IAuditLog {
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
}

const auditLogSchema = new Schema<IAuditLog>(
  {
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

// Defense in depth: audit logs are never mutated or deleted via Mongoose, even by internal code.
for (const op of ["findOneAndUpdate", "updateOne", "updateMany", "deleteOne", "deleteMany", "findOneAndDelete"] as const) {
  auditLogSchema.pre(op, function (next) {
    next(new Error("AuditLog documents are immutable"));
  });
}

export const AuditLog = model<IAuditLog>("AuditLog", auditLogSchema);
