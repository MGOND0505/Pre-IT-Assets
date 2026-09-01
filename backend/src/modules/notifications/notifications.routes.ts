import { Router } from "express";
import { validate } from "../../middleware/validate";
import * as notificationsController from "./notifications.controller";
import { listNotificationsQuerySchema, notificationIdParamsSchema } from "./notifications.validation";

// No permission/module gate - a notification only ever belongs to the requesting user
// themselves (same "always mine, no view-all" treatment as /my-access), so every authenticated
// role can reach this regardless of their granular permission matrix.
export const notificationsRouter = Router();

notificationsRouter.get("/", validate({ query: listNotificationsQuerySchema }), notificationsController.listNotifications);
notificationsRouter.patch("/read-all", notificationsController.markAllAsRead);
notificationsRouter.patch(
  "/:id/read",
  validate({ params: notificationIdParamsSchema }),
  notificationsController.markAsRead
);
