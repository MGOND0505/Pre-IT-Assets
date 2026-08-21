import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { getMyNotifications, markAllRead, markRead } from "./notifications.controller";

export const notificationsRouter = Router();

notificationsRouter.use(authenticate);
notificationsRouter.get("/", getMyNotifications);
notificationsRouter.patch("/read-all", markAllRead);
notificationsRouter.patch("/:id/read", markRead);
