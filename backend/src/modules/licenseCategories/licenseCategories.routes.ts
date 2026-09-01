import { Router } from "express";
import { requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as licenseCategoriesController from "./licenseCategories.controller";
import {
  createLicenseCategorySchema,
  licenseCategoryIdParamsSchema,
  listLicenseCategoriesQuerySchema,
  updateLicenseCategorySchema,
} from "./licenseCategories.validation";

export const licenseCategoriesRouter = Router();

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
