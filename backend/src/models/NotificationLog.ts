import { Schema, model, type Types } from "mongoose";

export type NotificationLogStatus = "sent" | "failed";

export interface INotificationLog {
  organization: Types.ObjectId;
  channel: string;
  to: string[];
  cc: string[];
  bcc: string[];
  subject: string;
  status: NotificationLogStatus;
  error: string;
  createdDate: Date;
}

const notificationLogSchema = new Schema<INotificationLog>({
  organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  channel: { type: String, required: true },
  to: { type: [String], default: [] },
  cc: { type: [String], default: [] },
  bcc: { type: [String], default: [] },
  subject: { type: String, default: "" },
  status: { type: String, enum: ["sent", "failed"], required: true, index: true },
  error: { type: String, default: "" },
  createdDate: { type: Date, default: Date.now, index: true },
});

notificationLogSchema.index({ organization: 1, createdDate: -1 });

export const NotificationLog = model<INotificationLog>("NotificationLog", notificationLogSchema);
