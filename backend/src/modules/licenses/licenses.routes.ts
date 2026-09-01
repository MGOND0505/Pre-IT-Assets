import { Router } from "express";
import { authorize, requireAdmin, requireModuleEnabled } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { uploadSpreadsheet } from "../../utils/upload";
import * as licensesController from "./licenses.controller";
import { previewLicenseImport, confirmLicenseImport, downloadLicenseTemplate, getLicenseImportHistory } from "./licenses.import";
import {
  confirmLicenseImportSchema,
  createLicenseSchema,
  licenseIdParamsSchema,
  listLicensesQuerySchema,
  updateLicenseSchema,
} from "./licenses.validation";
import { listImportHistoryQuerySchema } from "../importHistory/importHistory.validation";

export const licensesRouter = Router();

licensesRouter.get("/stats", authorize("licenses", "view"), licensesController.getLicenseStats);
// Always "mine", independent of the view-all permission /stats above ignores entirely - powers
// the Employee Portal dashboard's "My Licenses" widget.
licensesRouter.get("/my-summary", authorize("licenses", "view"), licensesController.getMyLicenseSummary);

licensesRouter.post(
  "/import/preview",
  authorize("licenses", "import"),
  uploadSpreadsheet.single("file"),
  previewLicenseImport
);
licensesRouter.post(
  "/import/confirm",
  authorize("licenses", "import"),
  validate({ body: confirmLicenseImportSchema }),
  confirmLicenseImport
);
licensesRouter.get("/import/template", authorize("licenses", "import"), downloadLicenseTemplate);
licensesRouter.get(
  "/import/history",
  authorize("licenses", "import"),
  validate({ query: listImportHistoryQuerySchema }),
  getLicenseImportHistory
);

licensesRouter.get(
  "/deleted",
  requireAdmin,
  requireModuleEnabled("recycleBin"),
  validate({ query: listLicensesQuerySchema }),
  licensesController.listDeletedLicenses
);

licensesRouter.get(
  "/",
  authorize("licenses", "view"),
  validate({ query: listLicensesQuerySchema }),
  licensesController.listLicenses
);
licensesRouter.post(
  "/",
  authorize("licenses", "create"),
  validate({ body: createLicenseSchema }),
  licensesController.createLicense
);
licensesRouter.get(
  "/:id",
  authorize("licenses", "view"),
  validate({ params: licenseIdParamsSchema }),
  licensesController.getLicense
);
licensesRouter.put(
  "/:id",
  authorize("licenses", "update"),
  validate({ params: licenseIdParamsSchema, body: updateLicenseSchema }),
  licensesController.updateLicense
);
licensesRouter.delete(
  "/:id",
  authorize("licenses", "delete"),
  validate({ params: licenseIdParamsSchema }),
  licensesController.deleteLicense
);
licensesRouter.post(
  "/:id/restore",
  requireAdmin,
  requireModuleEnabled("recycleBin"),
  validate({ params: licenseIdParamsSchema }),
  licensesController.restoreLicense
);
