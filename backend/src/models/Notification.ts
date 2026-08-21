import { Schema, model, type Types } from "mongoose";

export const NOTIFICATION_TYPES = [
  "SYSTEM",
  "ACCOUNT",
  "WARRANTY_EXPIRING",
  "AMC_EXPIRING",
  "LICENSE_EXPIRING",
  "RENEWAL_DUE",
  "LOW_STOCK",
  "LOW_LICENSE_AVAILABILITY",
  "COMPLIANCE_ISSUE",
  "ASSET_ASSIGNED",
  "ASSET_TRANSFERRED",
  "ASSET_RETURNED",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface INotification {
  recipient: Types.ObjectId | string;
  type: NotificationType;
  title: string;
  message: string;
  link: string | null;
  relatedModule: string | null;
  relatedId: Types.ObjectId | string | null;
  isRead: boolean;
}

const notificationSchema = new Schema<INotification>(
  {
    recipient: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    link: { type: String, default: null },
    relatedModule: { type: String, default: null },
    relatedId: { type: Schema.Types.Mixed, default: null },
    isRead: { type: Boolean, default: false, index: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });

export const Notification = model<INotification>("Notification", notificationSchema);
