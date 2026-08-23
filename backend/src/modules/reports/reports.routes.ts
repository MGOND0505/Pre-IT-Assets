import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import * as reportsController from "./reports.controller";

export const reportsRouter = Router();

reportsRouter.use(authenticate);
reportsRouter.use(authorize("reports", "read"));

reportsRouter.get("/assets", reportsController.getAssetReport);
reportsRouter.get("/assets/export", reportsController.exportAssetReport);
reportsRouter.get("/licenses", reportsController.getLicenseReport);
reportsRouter.get("/licenses/export", reportsController.exportLicenseReport);
