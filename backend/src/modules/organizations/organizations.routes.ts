import { Router } from "express";
import { validate } from "../../middleware/validate";
import * as organizationsController from "./organizations.controller";
import {
  createOrganizationSchema,
  listOrganizationsQuerySchema,
  organizationIdParamsSchema,
  setOrganizationStatusSchema,
  updateOrganizationSchema,
} from "./organizations.validation";

/** Mounted flat at /api/organizations, behind authenticate + requireSuperAdmin (see app.ts) -
 * this is the system-level Super Admin panel, not org-scoped, so it deliberately does NOT sit
 * under /api/:orgSlug/... like every other module. `:idOrSlug` accepts either a Mongo _id
 * (the list page has this) or a slug (the /{orgSlug}/organization page only has this). */
export const organizationsRouter = Router();

organizationsRouter.get("/", validate({ query: listOrganizationsQuerySchema }), organizationsController.listOrganizations);
organizationsRouter.post("/", validate({ body: createOrganizationSchema }), organizationsController.createOrganization);
organizationsRouter.get(
  "/deleted",
  validate({ query: listOrganizationsQuerySchema }),
  organizationsController.listDeletedOrganizations
);
organizationsRouter.get(
  "/:idOrSlug",
  validate({ params: organizationIdParamsSchema }),
  organizationsController.getOrganization
);
organizationsRouter.put(
  "/:idOrSlug",
  validate({ params: organizationIdParamsSchema, body: updateOrganizationSchema }),
  organizationsController.updateOrganization
);
organizationsRouter.patch(
  "/:idOrSlug/status",
  validate({ params: organizationIdParamsSchema, body: setOrganizationStatusSchema }),
  organizationsController.setOrganizationStatus
);
organizationsRouter.delete(
  "/:idOrSlug",
  validate({ params: organizationIdParamsSchema }),
  organizationsController.deleteOrganization
);
organizationsRouter.post(
  "/:idOrSlug/restore",
  validate({ params: organizationIdParamsSchema }),
  organizationsController.restoreOrganization
);
