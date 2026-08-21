import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { PERM } from "../../config/permissionCatalog";
import * as licenseCategoriesController from "./licenseCategories.controller";
import {
  createLicenseCategorySchema,
  licenseCategoryIdParamsSchema,
  listLicenseCategoriesQuerySchema,
  updateLicenseCategorySchema,
} from "./licenseCategories.validation";

export const licenseCategoriesRouter = Router();

licenseCategoriesRouter.use(authenticate);

licenseCategoriesRouter.get(
  "/",
  authorize(PERM.LICENSES_READ),
  validate({ query: listLicenseCategoriesQuerySchema }),
  licenseCategoriesController.listLicenseCategories
);
licenseCategoriesRouter.post(
  "/",
  authorize(PERM.LICENSES_CREATE),
  validate({ body: createLicenseCategorySchema }),
  licenseCategoriesController.createLicenseCategory
);
licenseCategoriesRouter.get(
  "/:id",
  authorize(PERM.LICENSES_READ),
  validate({ params: licenseCategoryIdParamsSchema }),
  licenseCategoriesController.getLicenseCategory
);
licenseCategoriesRouter.put(
  "/:id",
  authorize(PERM.LICENSES_WRITE),
  validate({ params: licenseCategoryIdParamsSchema, body: updateLicenseCategorySchema }),
  licenseCategoriesController.updateLicenseCategory
);
licenseCategoriesRouter.delete(
  "/:id",
  authorize(PERM.LICENSES_DELETE),
  validate({ params: licenseCategoryIdParamsSchema }),
  licenseCategoriesController.deleteLicenseCategory
);
