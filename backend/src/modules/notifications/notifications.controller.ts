import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok, fail } from "../../utils/response";
import {
  countUnread,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
} from "./notifications.service";

export const getMyNotifications = asyncHandler(async (req: Request, res: Response) => {
  const unreadOnly = req.query.unreadOnly === "true";
  const [items, unreadCount] = await Promise.all([
    listNotificationsForUser(req.user!.id, unreadOnly),
    countUnread(req.user!.id),
  ]);

  ok(res, { items, unreadCount }, "Notifications");
});

export const markRead = asyncHandler(async (req: Request, res: Response) => {
  const notification = await markNotificationRead(req.user!.id, req.params.id);

  if (!notification) {
    return fail(res, "Notification not found", 404);
  }

  return ok(res, notification, "Notification marked as read");
});

export const markAllRead = asyncHandler(async (req: Request, res: Response) => {
  await markAllNotificationsRead(req.user!.id);
  ok(res, null, "All notifications marked as read");
});
