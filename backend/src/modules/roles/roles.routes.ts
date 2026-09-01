import { Router } from "express";
import { authorize, requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as rolesController from "./roles.controller";
import {
  createRoleSchema,
  listRolesQuerySchema,
  roleIdParamsSchema,
  updateRoleSchema,
} from "./roles.validation";

export const rolesRouter = Router();

rolesRouter.get(
  "/deleted",
  requireAdmin,
  validate({ query: listRolesQuerySchema }),
  rolesController.listDeletedRoles
);
rolesRouter.get(
  "/",
  authorize("roles", "view"),
  validate({ query: listRolesQuerySchema }),
  rolesController.listRoles
);
rolesRouter.post(
  "/",
  authorize("roles", "create"),
  validate({ body: createRoleSchema }),
  rolesController.createRole
);
rolesRouter.get(
  "/:id",
  authorize("roles", "view"),
  validate({ params: roleIdParamsSchema }),
  rolesController.getRole
);
rolesRouter.put(
  "/:id",
  authorize("roles", "update"),
  validate({ params: roleIdParamsSchema, body: updateRoleSchema }),
  rolesController.updateRole
);
rolesRouter.delete(
  "/:id",
  authorize("roles", "delete"),
  validate({ params: roleIdParamsSchema }),
  rolesController.deleteRole
);
rolesRouter.post(
  "/:id/restore",
  requireAdmin,
  validate({ params: roleIdParamsSchema }),
  rolesController.restoreRole
);
