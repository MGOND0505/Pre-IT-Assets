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
