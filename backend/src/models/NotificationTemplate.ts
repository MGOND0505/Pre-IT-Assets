import { Schema, model, type Types } from "mongoose";

export const NOTIFICATION_TEMPLATE_KEYS = [
  "expiryDigest",
  "assetCreated",
  "assetUpdated",
  "assetDeleted",
  "assetsBulkDeleted",
  "assetImportBatch",
  "test",
  "ticketCreated",
  "ticketAssigned",
  "ticketReassigned",
  "ticketStatusChanged",
  "ticketCommentAdded",
  "ticketSlaWarning",
  "ticketEscalated",
  "ticketResolved",
  "ticketClosed",
  "taskAssigned",
  "taskReassigned",
  "taskStatusChanged",
  "taskOverdue",
] as const;

export type NotificationTemplateKey = (typeof NOTIFICATION_TEMPLATE_KEYS)[number];

export interface INotificationTemplate {
  organization: Types.ObjectId;
  key: NotificationTemplateKey;
  subject: string;
  bodyHtml: string;
}

const notificationTemplateSchema = new Schema<INotificationTemplate>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
    key: { type: String, enum: NOTIFICATION_TEMPLATE_KEYS, required: true },
    subject: { type: String, required: true },
    bodyHtml: { type: String, required: true },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

notificationTemplateSchema.index({ organization: 1, key: 1 }, { unique: true });

export const NotificationTemplate = model<INotificationTemplate>("NotificationTemplate", notificationTemplateSchema);
