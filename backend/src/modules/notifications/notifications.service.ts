import { Notification, type NotificationType } from "../../models/Notification";

type CreateNotificationInput = {
  recipients: string[];
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  relatedModule?: string | null;
  relatedId?: string | null;
};

export async function createNotification({
  recipients,
  type,
  title,
  message,
  link = null,
  relatedModule = null,
  relatedId = null,
}: CreateNotificationInput): Promise<void> {
  if (recipients.length === 0) return;

  await Notification.insertMany(
    recipients.map((recipient) => ({
      recipient,
      type,
      title,
      message,
      link,
      relatedModule,
      relatedId,
    }))
  );
}

export async function listNotificationsForUser(userId: string, unreadOnly = false) {
  const filter: Record<string, unknown> = { recipient: userId };
  if (unreadOnly) filter.isRead = false;

  return Notification.find(filter).sort({ createdAt: -1 }).limit(50);
}

export async function markNotificationRead(userId: string, notificationId: string) {
  return Notification.findOneAndUpdate(
    { _id: notificationId, recipient: userId },
    { isRead: true },
    { new: true }
  );
}

export async function markAllNotificationsRead(userId: string) {
  await Notification.updateMany({ recipient: userId, isRead: false }, { isRead: true });
}

export async function countUnread(userId: string) {
  return Notification.countDocuments({ recipient: userId, isRead: false });
}
