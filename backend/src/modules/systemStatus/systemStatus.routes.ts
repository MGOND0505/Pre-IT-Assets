import { Router } from "express";
import * as systemStatusController from "./systemStatus.controller";

/** Mounted flat at /api/system-status, behind authenticate + requireSuperAdmin (see app.ts) - same
 * "no per-route authorize() needed, the mount already gates it" convention as
 * organizations.routes.ts/globalUsers.routes.ts/platformSettings.routes.ts. One read-only endpoint,
 * no input, so no validation is needed. */
export const systemStatusRouter = Router();

systemStatusRouter.get("/", systemStatusController.getSystemStatus);
