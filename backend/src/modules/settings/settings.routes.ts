import { Router } from "express";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { uploadLogo } from "../../utils/upload";
import * as settingsController from "./settings.controller";
import { updateSettingsSchema, updateTemplateSchema } from "./settings.validation";

/** Mounted under the authenticated /api/:orgSlug tree - authenticate + resolveOrganization
 * already ran (see app.ts). The public branding/logo endpoints live in settings.public.routes.ts
 * instead, since those must be reachable before login. */
export const settingsRouter = Router();

// Deliberately NOT a blanket .use() - GETs need only "view", writes need "update".
settingsRouter.get("/", authorize("settings", "view"), settingsController.getSettings);
settingsRouter.put(
  "/",
  authorize("settings", "update"),
  validate({ body: updateSettingsSchema }),
  settingsController.updateSettings
);
settingsRouter.post("/logo", authorize("settings", "update"), uploadLogo.single("file"), settingsController.uploadLogo);
settingsRouter.delete("/logo", authorize("settings", "update"), settingsController.removeLogo);
settingsRouter.post("/test-email", authorize("settings", "update"), settingsController.sendTestAlertEmail);
settingsRouter.get(
  "/notification-templates",
  authorize("settings", "view"),
  settingsController.getNotificationTemplates
);
settingsRouter.put(
  "/notification-templates/:key",
  authorize("settings", "update"),
  validate({ body: updateTemplateSchema }),
  settingsController.updateNotificationTemplate
);
settingsRouter.get(
  "/notification-logs",
  authorize("settings", "view"),
  settingsController.getNotificationLogs
);
