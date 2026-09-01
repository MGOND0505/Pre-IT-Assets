import { Schema, model, type Types } from "mongoose";

export const CHAT_MESSAGE_ROLES = ["user", "assistant"] as const;
export type ChatMessageRole = (typeof CHAT_MESSAGE_ROLES)[number];

export const CHAT_MESSAGE_RESOLUTIONS = ["confirmed", "cancelled"] as const;
export type ChatMessageResolution = (typeof CHAT_MESSAGE_RESOLUTIONS)[number];

export interface IChatMessage {
  organization: Types.ObjectId;
  session: Types.ObjectId;
  role: ChatMessageRole;
  content: string;
  // Verbatim copies of what the frontend already renders for this message - persisted so a
  // reloaded conversation looks identical to when it was first sent. See ai-assistant.controller.ts.
  pendingChange: unknown;
  results: unknown;
  // Patched in by confirmChange/cancelChange once the user acts on this message's pendingChange -
  // null until then. See chat.service.ts#resolvePendingMessage.
  resolution: ChatMessageResolution | null;
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    session: { type: Schema.Types.ObjectId, ref: "ChatSession", required: true, index: true },
    role: { type: String, enum: CHAT_MESSAGE_ROLES, required: true },
    content: { type: String, default: "" },
    pendingChange: { type: Schema.Types.Mixed, default: null },
    results: { type: Schema.Types.Mixed, default: null },
    resolution: { type: String, enum: CHAT_MESSAGE_RESOLUTIONS, default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: false } }
);

chatMessageSchema.index({ session: 1, createdDate: 1 });

export const ChatMessage = model<IChatMessage>("ChatMessage", chatMessageSchema);
