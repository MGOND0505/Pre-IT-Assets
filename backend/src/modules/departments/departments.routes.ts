import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { PERM } from "../../config/permissionCatalog";
import * as departmentsController from "./departments.controller";
import {
  createDepartmentSchema,
  departmentIdParamsSchema,
  listDepartmentsQuerySchema,
  updateDepartmentSchema,
} from "./departments.validation";

export const departmentsRouter = Router();

departmentsRouter.use(authenticate);

departmentsRouter.get(
  "/",
  authorize(PERM.DEPARTMENTS_READ),
  validate({ query: listDepartmentsQuerySchema }),
  departmentsController.listDepartments
);
departmentsRouter.post(
  "/",
  authorize(PERM.DEPARTMENTS_CREATE),
  validate({ body: createDepartmentSchema }),
  departmentsController.createDepartment
);
departmentsRouter.get(
  "/:id",
  authorize(PERM.DEPARTMENTS_READ),
  validate({ params: departmentIdParamsSchema }),
  departmentsController.getDepartment
);
departmentsRouter.put(
  "/:id",
  authorize(PERM.DEPARTMENTS_WRITE),
  validate({ params: departmentIdParamsSchema, body: updateDepartmentSchema }),
  departmentsController.updateDepartment
);
departmentsRouter.delete(
  "/:id",
  authorize(PERM.DEPARTMENTS_DELETE),
  validate({ params: departmentIdParamsSchema }),
  departmentsController.deleteDepartment
);
