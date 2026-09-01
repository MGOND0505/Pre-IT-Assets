import { Router } from "express";
import { validate } from "../../middleware/validate";
import * as platformSettingsController from "./platformSettings.controller";
import { updatePlatformSettingsSchema } from "./platformSettings.validation";

/** Mounted flat at /api/platform-settings, behind authenticate + requireSuperAdmin (see app.ts) -
 * same "no per-route authorize() needed, the mount already gates it" convention as
 * organizations.routes.ts/globalUsers.routes.ts. Just two endpoints: this is a true global
 * singleton (Phase 9's "Global / Security Settings"), not a CRUD collection, so there's no
 * list/delete. */
export const platformSettingsRouter = Router();

platformSettingsRouter.get("/", platformSettingsController.getPlatformSettings);
platformSettingsRouter.put(
  "/",
  validate({ body: updatePlatformSettingsSchema }),
  platformSettingsController.updatePlatformSettings
);
