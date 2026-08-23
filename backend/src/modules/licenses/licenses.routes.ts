import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize, requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { uploadSpreadsheet } from "../../utils/upload";
import * as licensesController from "./licenses.controller";
import { previewLicenseImport, confirmLicenseImport } from "./licenses.import";
import {
  createLicenseSchema,
  licenseIdParamsSchema,
  listLicensesQuerySchema,
  updateLicenseSchema,
} from "./licenses.validation";

export const licensesRouter = Router();

licensesRouter.use(authenticate);

licensesRouter.get("/stats", authorize("licenses", "read"), licensesController.getLicenseStats);

licensesRouter.post(
  "/import/preview",
  authorize("licenses", "add"),
  uploadSpreadsheet.single("file"),
  previewLicenseImport
);
licensesRouter.post("/import/confirm", authorize("licenses", "add"), confirmLicenseImport);

licensesRouter.get(
  "/deleted",
  requireAdmin,
  validate({ query: listLicensesQuerySchema }),
  licensesController.listDeletedLicenses
);

licensesRouter.get(
  "/",
  authorize("licenses", "read"),
  validate({ query: listLicensesQuerySchema }),
  licensesController.listLicenses
);
licensesRouter.post(
  "/",
  authorize("licenses", "add"),
  validate({ body: createLicenseSchema }),
  licensesController.createLicense
);
licensesRouter.get(
  "/:id",
  authorize("licenses", "read"),
  validate({ params: licenseIdParamsSchema }),
  licensesController.getLicense
);
licensesRouter.put(
  "/:id",
  authorize("licenses", "edit"),
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
