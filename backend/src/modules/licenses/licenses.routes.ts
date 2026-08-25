import { Router } from "express";
import { authorize, requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { uploadSpreadsheet } from "../../utils/upload";
import * as licensesController from "./licenses.controller";
import { previewLicenseImport, confirmLicenseImport, downloadLicenseTemplate } from "./licenses.import";
import {
  createLicenseSchema,
  licenseIdParamsSchema,
  listLicensesQuerySchema,
  updateLicenseSchema,
} from "./licenses.validation";

export const licensesRouter = Router();

licensesRouter.get("/stats", authorize("licenses", "view"), licensesController.getLicenseStats);

licensesRouter.post(
  "/import/preview",
  authorize("licenses", "import"),
  uploadSpreadsheet.single("file"),
  previewLicenseImport
);
licensesRouter.post("/import/confirm", authorize("licenses", "import"), confirmLicenseImport);
licensesRouter.get("/import/template", authorize("licenses", "import"), downloadLicenseTemplate);

licensesRouter.get(
  "/deleted",
  requireAdmin,
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
  validate({ params: licenseIdParamsSchema }),
  licensesController.restoreLicense
);
