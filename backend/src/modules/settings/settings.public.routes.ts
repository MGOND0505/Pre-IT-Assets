import { Router } from "express";
import * as settingsController from "./settings.controller";

/** Mounted at /api/:orgSlug/public behind resolvePublicOrganization only (no authenticate) -
 * a login page must be able to fetch its organization's branding/logo before any session
 * exists. Never add anything here beyond narrow, public, read-only endpoints. */
export const publicSettingsRouter = Router();

publicSettingsRouter.get("/branding", settingsController.getBranding);
publicSettingsRouter.get("/logo", settingsController.getLogoImage);
