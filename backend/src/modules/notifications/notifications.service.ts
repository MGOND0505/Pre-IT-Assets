import { Notification } from "../../models/Notification";
import { ApiError } from "../../utils/ApiError";

/** Always scoped to exactly one user's own notifications - there is no "view all" concept here,
 * unlike assets/tickets/tasks/licenses, since a notification only ever means something to the
 * person it was created for. */
export async function listNotifications(
  organizationId: string,
  userId: string,
  input: { page?: number; limit?: number }
) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;
  const filter = { organization: organizationId, user: userId };

  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ ...filter, read: false }),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit), unreadCount };
}

export async function markAsRead(organizationId: string, userId: string, id: string) {
  const notification = await Notification.findOne({ _id: id, organization: organizationId, user: userId });
  if (!notification) throw new ApiError(404, "Notification not found");

  notification.read = true;
  notification.readAt = new Date();
  await notification.save();
  return notification;
}

export async function markAllAsRead(organizationId: string, userId: string) {
  const result = await Notification.updateMany(
    { organization: organizationId, user: userId, read: false },
    { $set: { read: true, readAt: new Date() } }
  );
  return { updated: result.modifiedCount };
}
