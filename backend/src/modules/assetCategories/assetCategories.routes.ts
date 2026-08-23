import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
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

assetCategoriesRouter.use(authenticate);

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
