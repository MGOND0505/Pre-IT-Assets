import { Router } from "express";
import { requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { uploadSpreadsheet } from "../../utils/upload";
import * as helpdeskPrioritiesController from "./helpdeskPriorities.controller";
import {
  previewHelpdeskPriorityImport,
  confirmHelpdeskPriorityImport,
  downloadHelpdeskPriorityTemplate,
  getHelpdeskPriorityImportHistory,
} from "./helpdeskPriorities.import";
import {
  confirmHelpdeskPriorityImportSchema,
  createHelpdeskPrioritySchema,
  helpdeskPriorityIdParamsSchema,
  listHelpdeskPrioritiesQuerySchema,
  updateHelpdeskPrioritySchema,
} from "./helpdeskPriorities.validation";
import { listImportHistoryQuerySchema } from "../importHistory/importHistory.validation";

export const helpdeskPrioritiesRouter = Router();

helpdeskPrioritiesRouter.get(
  "/deleted",
  requireAdmin,
  validate({ query: listHelpdeskPrioritiesQuerySchema }),
  helpdeskPrioritiesController.listDeletedHelpdeskPriorities
);
// Deliberately not authorize()-gated: this is cross-module dropdown data (e.g. a user with
// tasks:create but not helpdeskPriorities:view still needs priority names in a ticket picker), and
// every route below is still org-scoped via req.organization - a real permission gate here would
// break legitimate cross-module dropdowns for users who have no helpdeskPriorities permission.
helpdeskPrioritiesRouter.get(
  "/",
  validate({ query: listHelpdeskPrioritiesQuerySchema }),
  helpdeskPrioritiesController.listHelpdeskPriorities
);
helpdeskPrioritiesRouter.post(
  "/",
  requireAdmin,
  validate({ body: createHelpdeskPrioritySchema }),
  helpdeskPrioritiesController.createHelpdeskPriority
);
// Mounted ahead of the generic "/:id" routes below, same ordering assets.routes.ts uses for its
// own "/import/*" routes, so Express never mistakes "import" for an :id value. Admin-only like
// every other write route in this module - no helpdeskPriorities permission module exists at all.
helpdeskPrioritiesRouter.post(
  "/import/preview",
  requireAdmin,
  uploadSpreadsheet.single("file"),
  previewHelpdeskPriorityImport
);
helpdeskPrioritiesRouter.post(
  "/import/confirm",
  requireAdmin,
  validate({ body: confirmHelpdeskPriorityImportSchema }),
  confirmHelpdeskPriorityImport
);
helpdeskPrioritiesRouter.get("/import/template", requireAdmin, downloadHelpdeskPriorityTemplate);
helpdeskPrioritiesRouter.get(
  "/import/history",
  requireAdmin,
  validate({ query: listImportHistoryQuerySchema }),
  getHelpdeskPriorityImportHistory
);

helpdeskPrioritiesRouter.get(
  "/:id",
  validate({ params: helpdeskPriorityIdParamsSchema }),
  helpdeskPrioritiesController.getHelpdeskPriority
);
helpdeskPrioritiesRouter.put(
  "/:id",
  requireAdmin,
  validate({ params: helpdeskPriorityIdParamsSchema, body: updateHelpdeskPrioritySchema }),
  helpdeskPrioritiesController.updateHelpdeskPriority
);
helpdeskPrioritiesRouter.delete(
  "/:id",
  requireAdmin,
  validate({ params: helpdeskPriorityIdParamsSchema }),
  helpdeskPrioritiesController.deleteHelpdeskPriority
);
helpdeskPrioritiesRouter.post(
  "/:id/restore",
  requireAdmin,
  validate({ params: helpdeskPriorityIdParamsSchema }),
  helpdeskPrioritiesController.restoreHelpdeskPriority
);
