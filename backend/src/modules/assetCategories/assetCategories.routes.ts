import { Router } from "express";
import { requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as assetCategoriesController from "./assetCategories.controller";
import {
  assetCategoryIdParamsSchema,
  createAssetCategorySchema,
  listAssetCategoriesQuerySchema,
  updateAssetCategorySchema,
} from "./assetCategories.validation";

export const assetCategoriesRouter = Router();

// Deliberately not authorize()-gated: this is cross-module dropdown data (e.g. a user with
// tasks:create but not assetCategories:view still needs category names in an asset picker), and
// every route below is still org-scoped via req.organization - a real permission gate here would
// break legitimate cross-module dropdowns for users who have no assetCategories permission at all.
assetCategoriesRouter.get(
  "/",
  validate({ query: listAssetCategoriesQuerySchema }),
  assetCategoriesController.listAssetCategories
);
assetCategoriesRouter.post(
  "/",
  requireAdmin,
  validate({ body: createAssetCategorySchema }),
  assetCategoriesController.createAssetCategory
);
assetCategoriesRouter.get(
  "/:id",
  validate({ params: assetCategoryIdParamsSchema }),
  assetCategoriesController.getAssetCategory
);
assetCategoriesRouter.put(
  "/:id",
  requireAdmin,
  validate({ params: assetCategoryIdParamsSchema, body: updateAssetCategorySchema }),
  assetCategoriesController.updateAssetCategory
);
assetCategoriesRouter.delete(
  "/:id",
  requireAdmin,
  validate({ params: assetCategoryIdParamsSchema }),
  assetCategoriesController.deleteAssetCategory
);
