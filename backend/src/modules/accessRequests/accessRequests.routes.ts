import { Router } from "express";
import { validate } from "../../middleware/validate";
import * as accessRequestsController from "./accessRequests.controller";
import {
  accessRequestIdParamsSchema,
  createAccessRequestSchema,
  decideAccessRequestSchema,
} from "./accessRequests.validation";

/** Mounted flat at /api/access-requests, behind `authenticate` only (no requireSuperAdmin) -
 * both a Sub-Super Admin (create their own requests, list their own) and a Super Admin (list
 * all, decide) use this, gated per-action inside each controller function. Not org-scoped:
 * a Sub-Super Admin has no organization of their own to route this under. */
export const accessRequestsRouter = Router();

accessRequestsRouter.get("/organizations", accessRequestsController.listBrowsableOrganizations);
accessRequestsRouter.get("/", accessRequestsController.listAccessRequests);
accessRequestsRouter.post(
  "/",
  validate({ body: createAccessRequestSchema }),
  accessRequestsController.createAccessRequest
);
accessRequestsRouter.patch(
  "/:id",
  validate({ params: accessRequestIdParamsSchema, body: decideAccessRequestSchema }),
  accessRequestsController.decideAccessRequest
);
