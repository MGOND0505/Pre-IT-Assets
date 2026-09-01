import { Router } from "express";
import { requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { uploadSpreadsheet } from "../../utils/upload";
import * as assetCategoriesController from "./assetCategories.controller";
import {
  previewAssetCategoryImport,
  confirmAssetCategoryImport,
  downloadAssetCategoryTemplate,
  getAssetCategoryImportHistory,
} from "./assetCategories.import";
import {
  assetCategoryIdParamsSchema,
  confirmAssetCategoryImportSchema,
  createAssetCategorySchema,
  listAssetCategoriesQuerySchema,
  updateAssetCategorySchema,
} from "./assetCategories.validation";
import { listImportHistoryQuerySchema } from "../importHistory/importHistory.validation";

export const assetCategoriesRouter = Router();

// Mounted ahead of the generic "/:id" routes below, same ordering assets.routes.ts uses for its
// own "/import/*" routes, so Express never mistakes "import" for an :id value. Admin-only like
// every other write route in this module - no assetCategories permission module exists at all.
assetCategoriesRouter.post(
  "/import/preview",
  requireAdmin,
  uploadSpreadsheet.single("file"),
  previewAssetCategoryImport
);
assetCategoriesRouter.post(
  "/import/confirm",
  requireAdmin,
  validate({ body: confirmAssetCategoryImportSchema }),
  confirmAssetCategoryImport
);
assetCategoriesRouter.get("/import/template", requireAdmin, downloadAssetCategoryTemplate);
assetCategoriesRouter.get(
  "/import/history",
  requireAdmin,
  validate({ query: listImportHistoryQuerySchema }),
  getAssetCategoryImportHistory
);

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
