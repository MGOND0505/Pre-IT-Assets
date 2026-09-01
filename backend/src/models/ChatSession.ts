import { Schema, model, type Types } from "mongoose";

export interface IChatSession {
  organization: Types.ObjectId;
  user: Types.ObjectId;
  title: string;
  lastMessageAt: Date;
}

const chatSessionSchema = new Schema<IChatSession>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true },
    lastMessageAt: { type: Date, required: true, default: Date.now },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

chatSessionSchema.index({ organization: 1, user: 1, lastMessageAt: -1 });

export const ChatSession = model<IChatSession>("ChatSession", chatSessionSchema);
