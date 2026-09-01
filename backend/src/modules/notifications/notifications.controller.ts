import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import * as notificationsService from "./notifications.service";

export const listNotifications = asyncHandler(async (req: Request, res: Response) => {
  const result = await notificationsService.listNotifications(req.organization!._id, req.user!.id, req.query as never);
  ok(res, result, "Notifications");
});

export const markAsRead = asyncHandler(async (req: Request, res: Response) => {
  const notification = await notificationsService.markAsRead(req.organization!._id, req.user!.id, req.params.id);
  ok(res, notification, "Notification marked as read");
});

export const markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
  const result = await notificationsService.markAllAsRead(req.organization!._id, req.user!.id);
  ok(res, result, "All notifications marked as read");
});
