import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { PERM } from "../../config/permissionCatalog";
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
  authorize(PERM.ASSETS_READ),
  validate({ query: listAssetCategoriesQuerySchema }),
  assetCategoriesController.listAssetCategories
);
assetCategoriesRouter.post(
  "/",
  authorize(PERM.ASSETS_CREATE),
  validate({ body: createAssetCategorySchema }),
  assetCategoriesController.createAssetCategory
);
assetCategoriesRouter.get(
  "/:id",
  authorize(PERM.ASSETS_READ),
  validate({ params: assetCategoryIdParamsSchema }),
  assetCategoriesController.getAssetCategory
);
assetCategoriesRouter.put(
  "/:id",
  authorize(PERM.ASSETS_WRITE),
  validate({ params: assetCategoryIdParamsSchema, body: updateAssetCategorySchema }),
  assetCategoriesController.updateAssetCategory
);
assetCategoriesRouter.delete(
  "/:id",
  authorize(PERM.ASSETS_DELETE),
  validate({ params: assetCategoryIdParamsSchema }),
  assetCategoriesController.deleteAssetCategory
);
