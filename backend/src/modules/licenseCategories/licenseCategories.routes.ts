import { Router } from "express";
import { requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { uploadSpreadsheet } from "../../utils/upload";
import * as licenseCategoriesController from "./licenseCategories.controller";
import {
  previewLicenseCategoryImport,
  confirmLicenseCategoryImport,
  downloadLicenseCategoryTemplate,
  getLicenseCategoryImportHistory,
} from "./licenseCategories.import";
import {
  confirmLicenseCategoryImportSchema,
  createLicenseCategorySchema,
  licenseCategoryIdParamsSchema,
  listLicenseCategoriesQuerySchema,
  updateLicenseCategorySchema,
} from "./licenseCategories.validation";
import { listImportHistoryQuerySchema } from "../importHistory/importHistory.validation";

export const licenseCategoriesRouter = Router();

// Mounted ahead of the generic "/:id" routes below, same ordering assets.routes.ts uses for its
// own "/import/*" routes, so Express never mistakes "import" for an :id value. Admin-only like
// every other write route in this module - no licenseCategories permission module exists at all.
licenseCategoriesRouter.post(
  "/import/preview",
  requireAdmin,
  uploadSpreadsheet.single("file"),
  previewLicenseCategoryImport
);
licenseCategoriesRouter.post(
  "/import/confirm",
  requireAdmin,
  validate({ body: confirmLicenseCategoryImportSchema }),
  confirmLicenseCategoryImport
);
licenseCategoriesRouter.get("/import/template", requireAdmin, downloadLicenseCategoryTemplate);
licenseCategoriesRouter.get(
  "/import/history",
  requireAdmin,
  validate({ query: listImportHistoryQuerySchema }),
  getLicenseCategoryImportHistory
);

// Deliberately not authorize()-gated: this is cross-module dropdown data (e.g. a user with
// licenses:create but not licenseCategories:view still needs category names in a license picker),
// and every route below is still org-scoped via req.organization - a real permission gate here
// would break legitimate cross-module dropdowns for users who have no licenseCategories permission.
licenseCategoriesRouter.get(
  "/",
  validate({ query: listLicenseCategoriesQuerySchema }),
  licenseCategoriesController.listLicenseCategories
);
licenseCategoriesRouter.post(
  "/",
  requireAdmin,
  validate({ body: createLicenseCategorySchema }),
  licenseCategoriesController.createLicenseCategory
);
licenseCategoriesRouter.get(
  "/:id",
  validate({ params: licenseCategoryIdParamsSchema }),
  licenseCategoriesController.getLicenseCategory
);
licenseCategoriesRouter.put(
  "/:id",
  requireAdmin,
  validate({ params: licenseCategoryIdParamsSchema, body: updateLicenseCategorySchema }),
  licenseCategoriesController.updateLicenseCategory
);
licenseCategoriesRouter.delete(
  "/:id",
  requireAdmin,
  validate({ params: licenseCategoryIdParamsSchema }),
  licenseCategoriesController.deleteLicenseCategory
);
