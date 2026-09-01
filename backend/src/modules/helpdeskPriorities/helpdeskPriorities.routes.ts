import { Router } from "express";
import { requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as helpdeskPrioritiesController from "./helpdeskPriorities.controller";
import {
  createHelpdeskPrioritySchema,
  helpdeskPriorityIdParamsSchema,
  listHelpdeskPrioritiesQuerySchema,
  updateHelpdeskPrioritySchema,
} from "./helpdeskPriorities.validation";

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
