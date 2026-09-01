import { Router } from "express";
import { authorize, requireAdmin, requireModuleEnabled } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as designationsController from "./designations.controller";
import {
  createDesignationSchema,
  designationIdParamsSchema,
  listDesignationsQuerySchema,
  updateDesignationSchema,
} from "./designations.validation";

export const designationsRouter = Router();

designationsRouter.get(
  "/deleted",
  requireAdmin,
  requireModuleEnabled("recycleBin"),
  validate({ query: listDesignationsQuerySchema }),
  designationsController.listDeletedDesignations
);
designationsRouter.get(
  "/",
  authorize("designations", "view"),
  validate({ query: listDesignationsQuerySchema }),
  designationsController.listDesignations
);
designationsRouter.post(
  "/",
  authorize("designations", "create"),
  validate({ body: createDesignationSchema }),
  designationsController.createDesignation
);
designationsRouter.get(
  "/:id",
  authorize("designations", "view"),
  validate({ params: designationIdParamsSchema }),
  designationsController.getDesignation
);
designationsRouter.put(
  "/:id",
  authorize("designations", "update"),
  validate({ params: designationIdParamsSchema, body: updateDesignationSchema }),
  designationsController.updateDesignation
);
designationsRouter.delete(
  "/:id",
  authorize("designations", "delete"),
  validate({ params: designationIdParamsSchema }),
  designationsController.deleteDesignation
);
designationsRouter.post(
  "/:id/restore",
  requireAdmin,
  requireModuleEnabled("recycleBin"),
  validate({ params: designationIdParamsSchema }),
  designationsController.restoreDesignation
);
