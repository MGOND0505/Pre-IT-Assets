import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { PERM } from "../../config/permissionCatalog";
import * as settingsController from "./settings.controller";
import { updateSettingsSchema } from "./settings.validation";

export const settingsRouter = Router();

settingsRouter.use(authenticate);

settingsRouter.get("/", authorize(PERM.SETTINGS_READ), settingsController.getSettings);
settingsRouter.put(
  "/",
  authorize(PERM.SETTINGS_WRITE),
  validate({ body: updateSettingsSchema }),
  settingsController.updateSettings
);
