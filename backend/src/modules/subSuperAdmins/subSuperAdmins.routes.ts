import { Router } from "express";
import { validate } from "../../middleware/validate";
import { uploadLogo } from "../../utils/upload";
import * as subSuperAdminsController from "./subSuperAdmins.controller";
import {
  createSubSuperAdminSchema,
  grantedOrganizationIdParamsSchema,
  resetSubSuperAdminPasswordSchema,
  setSubSuperAdminStatusSchema,
  subSuperAdminIdParamsSchema,
  updateGrantedOrganizationDetailsSchema,
  updateGrantedOrganizationRetentionSchema,
  updateSubSuperAdminAccessSchema,
  updateSubSuperAdminSchema,
} from "./subSuperAdmins.validation";

/** Mounted flat at /api/sub-super-admins, behind authenticate + requireSuperAdmin (see app.ts) -
 * managing Sub-Super Admin accounts is system-level, not org-scoped, same reasoning as the
 * Organizations module. */
export const subSuperAdminsRouter = Router();

subSuperAdminsRouter.get("/", subSuperAdminsController.listSubSuperAdmins);
subSuperAdminsRouter.post(
  "/",
  validate({ body: createSubSuperAdminSchema }),
  subSuperAdminsController.createSubSuperAdmin
);
subSuperAdminsRouter.get(
  "/:id",
  validate({ params: subSuperAdminIdParamsSchema }),
  subSuperAdminsController.getSubSuperAdmin
);
subSuperAdminsRouter.put(
  "/:id",
  validate({ params: subSuperAdminIdParamsSchema, body: updateSubSuperAdminSchema }),
  subSuperAdminsController.updateSubSuperAdmin
);
subSuperAdminsRouter.put(
  "/:id/access",
  validate({ params: subSuperAdminIdParamsSchema, body: updateSubSuperAdminAccessSchema }),
  subSuperAdminsController.updateSubSuperAdminAccess
);
subSuperAdminsRouter.patch(
  "/:id/status",
  validate({ params: subSuperAdminIdParamsSchema, body: setSubSuperAdminStatusSchema }),
  subSuperAdminsController.setSubSuperAdminStatus
);
subSuperAdminsRouter.patch(
  "/:id/reset-password",
  validate({ params: subSuperAdminIdParamsSchema, body: resetSubSuperAdminPasswordSchema }),
  subSuperAdminsController.resetSubSuperAdminPassword
);
subSuperAdminsRouter.delete(
  "/:id",
  validate({ params: subSuperAdminIdParamsSchema }),
  subSuperAdminsController.deleteSubSuperAdmin
);

/** Mounted flat at /api/my-organizations, behind authenticate ONLY (no requireSuperAdmin) -
 * a Sub-Super Admin's self-service landing page needs to see just the organizations THEY hold
 * a grant for. Safe for any role to call: it only ever returns the CALLER's own orgAccess,
 * which is empty (and therefore returns an empty list) for every role except subSuperAdmin. */
export const myOrganizationsRouter = Router();

myOrganizationsRouter.get("/", subSuperAdminsController.listMyGrantedOrganizations);
myOrganizationsRouter.patch(
  "/:id/recycle-bin-retention",
  validate({ params: grantedOrganizationIdParamsSchema, body: updateGrantedOrganizationRetentionSchema }),
  subSuperAdminsController.updateMyGrantedOrganizationRetention
);
myOrganizationsRouter.patch(
  "/:id/details",
  validate({ params: grantedOrganizationIdParamsSchema, body: updateGrantedOrganizationDetailsSchema }),
  subSuperAdminsController.updateMyGrantedOrganizationDetails
);
myOrganizationsRouter.post(
  "/:id/logo",
  validate({ params: grantedOrganizationIdParamsSchema }),
  uploadLogo.single("file"),
  subSuperAdminsController.uploadMyGrantedOrganizationLogo
);
myOrganizationsRouter.delete(
  "/:id/logo",
  validate({ params: grantedOrganizationIdParamsSchema }),
  subSuperAdminsController.removeMyGrantedOrganizationLogo
);
