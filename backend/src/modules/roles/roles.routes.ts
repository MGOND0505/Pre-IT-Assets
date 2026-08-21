import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { PERM } from "../../config/permissionCatalog";
import * as rolesController from "./roles.controller";
import { createRoleSchema, roleIdParamsSchema, updateRoleSchema } from "./roles.validation";

export const rolesRouter = Router();

rolesRouter.use(authenticate);

rolesRouter.get("/", authorize(PERM.ROLES_READ), rolesController.getRoles);
rolesRouter.post("/", authorize(PERM.ROLES_CREATE), validate({ body: createRoleSchema }), rolesController.createRole);
rolesRouter.get("/:id", authorize(PERM.ROLES_READ), validate({ params: roleIdParamsSchema }), rolesController.getRole);
rolesRouter.put(
  "/:id",
  authorize(PERM.ROLES_WRITE),
  validate({ params: roleIdParamsSchema, body: updateRoleSchema }),
  rolesController.updateRole
);
rolesRouter.delete(
  "/:id",
  authorize(PERM.ROLES_DELETE),
  validate({ params: roleIdParamsSchema }),
  rolesController.deleteRole
);
rolesRouter.get(
  "/:id/users",
  authorize(PERM.ROLES_READ),
  validate({ params: roleIdParamsSchema }),
  rolesController.getUsersByRole
);
