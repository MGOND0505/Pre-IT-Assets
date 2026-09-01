import { Schema, model, type Types } from "mongoose";
import type { NotificationTemplateKey } from "./NotificationTemplate";

/** A user-facing, in-app "My Notifications" feed - distinct from NotificationLog (an admin-only
 * email-delivery audit trail) and NotificationTemplate (the email content those deliveries use).
 * Created alongside the existing email notifications (see helpdeskNotifications.ts#notifyTicketEvent
 * and taskNotifications.ts#notifyTaskEvent) so both channels stay in sync from one call site per
 * event, rather than duplicating "who gets notified about what" logic a second time. */
export interface INotification {
  organization: Types.ObjectId;
  user: Types.ObjectId;
  type: NotificationTemplateKey;
  title: string;
  // Org-relative in-app path (e.g. "/helpdesk/<id>") - null for event types with no natural
  // detail page to link to.
  link: string | null;
  read: boolean;
  readAt: Date | null;
  createdDate: Date;
}

const notificationSchema = new Schema<INotification>({
  organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  link: { type: String, default: null },
  read: { type: Boolean, default: false, index: true },
  readAt: { type: Date, default: null },
  createdDate: { type: Date, default: Date.now, index: true },
});

notificationSchema.index({ organization: 1, user: 1, createdDate: -1 });

export const Notification = model<INotification>("Notification", notificationSchema);
