import { Router } from "express";
import { requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as helpdeskCategoriesController from "./helpdeskCategories.controller";
import {
  createHelpdeskCategorySchema,
  helpdeskCategoryIdParamsSchema,
  listHelpdeskCategoriesQuerySchema,
  updateHelpdeskCategorySchema,
} from "./helpdeskCategories.validation";

export const helpdeskCategoriesRouter = Router();

helpdeskCategoriesRouter.get(
  "/deleted",
  requireAdmin,
  validate({ query: listHelpdeskCategoriesQuerySchema }),
  helpdeskCategoriesController.listDeletedHelpdeskCategories
);
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
  validate({ params: helpdeskCategoryIdParamsSchema }),
  helpdeskCategoriesController.restoreHelpdeskCategory
);
