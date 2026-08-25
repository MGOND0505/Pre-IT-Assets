import { Router } from "express";
import { authorize } from "../../middleware/authorize";
import * as reportsController from "./reports.controller";

export const reportsRouter = Router();

// Export permission belongs to the resource being exported, not to "viewed the reports page" -
// deliberately NOT a blanket .use() (that would still require reports:view for export too).
reportsRouter.get("/assets", authorize("reports", "view"), reportsController.getAssetReport);
reportsRouter.get("/assets/export", authorize("assets", "export"), reportsController.exportAssetReport);
reportsRouter.get("/licenses", authorize("reports", "view"), reportsController.getLicenseReport);
reportsRouter.get("/licenses/export", authorize("licenses", "export"), reportsController.exportLicenseReport);
