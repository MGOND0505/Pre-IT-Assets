import { Router } from "express";
import { requireAdmin, requireModuleEnabled } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { uploadSpreadsheet } from "../../utils/upload";
import * as helpdeskCategoriesController from "./helpdeskCategories.controller";
import {
  previewHelpdeskCategoryImport,
  confirmHelpdeskCategoryImport,
  downloadHelpdeskCategoryTemplate,
  getHelpdeskCategoryImportHistory,
} from "./helpdeskCategories.import";
import {
  confirmHelpdeskCategoryImportSchema,
  createHelpdeskCategorySchema,
  helpdeskCategoryIdParamsSchema,
  listHelpdeskCategoriesQuerySchema,
  updateHelpdeskCategorySchema,
} from "./helpdeskCategories.validation";
import { listImportHistoryQuerySchema } from "../importHistory/importHistory.validation";

export const helpdeskCategoriesRouter = Router();

helpdeskCategoriesRouter.get(
  "/deleted",
  requireAdmin,
  requireModuleEnabled("recycleBin"),
  validate({ query: listHelpdeskCategoriesQuerySchema }),
  helpdeskCategoriesController.listDeletedHelpdeskCategories
);
// Deliberately not authorize()-gated: this is cross-module dropdown data (e.g. a user with
// tasks:create but not helpdeskCategories:view still needs category names in a ticket picker), and
// every route below is still org-scoped via req.organization - a real permission gate here would
// break legitimate cross-module dropdowns for users who have no helpdeskCategories permission.
helpdeskCategoriesRouter.get(
  "/",
  validate({ query: listHelpdeskCategoriesQuerySchema }),
  helpdeskCategoriesController.listHelpdeskCategories
);
helpdeskCategoriesRouter.post(
  "/",
  requireAdmin,
  validate({ body: createHelpdeskCategorySchema }),
  helpdeskCategoriesController.createHelpdeskCategory
);
// Mounted ahead of the generic "/:id" routes below, same ordering assets.routes.ts uses for its
// own "/import/*" routes, so Express never mistakes "import" for an :id value. Admin-only like
// every other write route in this module - no helpdeskCategories permission module exists at all.
helpdeskCategoriesRouter.post(
  "/import/preview",
  requireAdmin,
  uploadSpreadsheet.single("file"),
  previewHelpdeskCategoryImport
);
helpdeskCategoriesRouter.post(
  "/import/confirm",
  requireAdmin,
  validate({ body: confirmHelpdeskCategoryImportSchema }),
  confirmHelpdeskCategoryImport
);
helpdeskCategoriesRouter.get("/import/template", requireAdmin, downloadHelpdeskCategoryTemplate);
helpdeskCategoriesRouter.get(
  "/import/history",
  requireAdmin,
  validate({ query: listImportHistoryQuerySchema }),
  getHelpdeskCategoryImportHistory
);

helpdeskCategoriesRouter.get(
  "/:id",
  validate({ params: helpdeskCategoryIdParamsSchema }),
  helpdeskCategoriesController.getHelpdeskCategory
);
helpdeskCategoriesRouter.put(
  "/:id",
  requireAdmin,
  validate({ params: helpdeskCategoryIdParamsSchema, body: updateHelpdeskCategorySchema }),
  helpdeskCategoriesController.updateHelpdeskCategory
);
helpdeskCategoriesRouter.delete(
  "/:id",
  requireAdmin,
  validate({ params: helpdeskCategoryIdParamsSchema }),
  helpdeskCategoriesController.deleteHelpdeskCategory
);
helpdeskCategoriesRouter.post(
  "/:id/restore",
  requireAdmin,
  requireModuleEnabled("recycleBin"),
  validate({ params: helpdeskCategoryIdParamsSchema }),
  helpdeskCategoriesController.restoreHelpdeskCategory
);
