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
