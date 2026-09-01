import { Schema, model, type Types } from "mongoose";

/** Phase 3 of the AI Assistant rebuild - the full chat transcript for one user's conversation
 * with the assistant in one organization. Deliberately ephemeral: nothing here is meant to be a
 * permanent record (that's what AiActivityLog.ts is for, as a lightweight separate audit trail) -
 * the TTL index below has MongoDB's own background monitor permanently delete the whole document
 * 48 hours after its last activity, no application code required to enforce that. */
export interface IAiMessage {
  role: "user" | "assistant" | "tool";
  content: string;
  toolName?: string | null;
  createdAt: Date;
}

export interface IAiConversation {
  organization: Types.ObjectId;
  user: Types.ObjectId;
  messages: IAiMessage[];
  // The TTL anchor - updated every time a message is appended, so an actively-used conversation
  // never expires mid-use, only one that's gone quiet for a full 48 hours. NOT createdDate.
  lastActivityAt: Date;
}

const aiMessageSchema = new Schema<IAiMessage>(
  {
    role: { type: String, enum: ["user", "assistant", "tool"], required: true },
    content: { type: String, required: true },
    toolName: { type: String, default: null },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const aiConversationSchema = new Schema<IAiConversation>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    messages: { type: [aiMessageSchema], default: [] },
    lastActivityAt: { type: Date, default: () => new Date() },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

// The ONLY mechanism enforcing the 48-hour auto-delete requirement - a real delete (not a
// soft-delete flag), handled entirely by MongoDB's own TTL background monitor. Deliberately no
// redundant cron sweep alongside this. 172800 seconds = 48 hours.
aiConversationSchema.index({ lastActivityAt: 1 }, { expireAfterSeconds: 172800 });

export const AiConversation = model<IAiConversation>("AiConversation", aiConversationSchema);
