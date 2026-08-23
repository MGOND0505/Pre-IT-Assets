import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as settingsController from "./settings.controller";
import { updateSettingsSchema } from "./settings.validation";

export const settingsRouter = Router();

settingsRouter.use(authenticate);
settingsRouter.use(requireAdmin);

settingsRouter.get("/", settingsController.getSettings);
settingsRouter.put("/", validate({ body: updateSettingsSchema }), settingsController.updateSettings);
