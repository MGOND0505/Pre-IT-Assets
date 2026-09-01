import { Schema, model, type Types } from "mongoose";

/** Phase 3 of the AI Assistant rebuild - a lightweight per-action audit record, separate from the
 * full chat transcript in AiConversation.ts. Covers "AI search/query logs" and "temporary AI
 * activity logs" as their own auditable trail: what tool ran / what was asked, never a duplicate
 * of the actual returned data (see `summary`'s own doc comment) - keep this distinct from the
 * general AuditLog used by every other module (audit.service.ts#logAction), don't conflate them. */
export interface IAiActivityLog {
  organization: Types.ObjectId;
  user: Types.ObjectId;
  action: string;
  toolName: string | null;
  // A short human-readable description of WHAT was asked/done (e.g. `Searched assets: "laptop"`)
  // - never the full raw data payload returned by a tool call, just enough to audit intent.
  summary: string;
  createdAt: Date;
}

const aiActivityLogSchema = new Schema<IAiActivityLog>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    action: { type: String, required: true },
    toolName: { type: String, default: null },
    summary: { type: String, required: true },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: false } }
);

// Same TTL treatment as AiConversation - a real delete, 48 hours after creation, entirely via
// MongoDB's own background TTL monitor. No redundant cron sweep.
aiActivityLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 172800 });

export const AiActivityLog = model<IAiActivityLog>("AiActivityLog", aiActivityLogSchema);
