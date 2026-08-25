import { Router } from "express";
import { authorize, requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as departmentsController from "./departments.controller";
import {
  createDepartmentSchema,
  departmentIdParamsSchema,
  listDepartmentsQuerySchema,
  updateDepartmentSchema,
} from "./departments.validation";

export const departmentsRouter = Router();

departmentsRouter.get(
  "/deleted",
  requireAdmin,
  validate({ query: listDepartmentsQuerySchema }),
  departmentsController.listDeletedDepartments
);
departmentsRouter.get(
  "/",
  authorize("departments", "view"),
  validate({ query: listDepartmentsQuerySchema }),
  departmentsController.listDepartments
);
departmentsRouter.post(
  "/",
  authorize("departments", "create"),
  validate({ body: createDepartmentSchema }),
  departmentsController.createDepartment
);
departmentsRouter.get(
  "/:id",
  authorize("departments", "view"),
  validate({ params: departmentIdParamsSchema }),
  departmentsController.getDepartment
);
departmentsRouter.put(
  "/:id",
  authorize("departments", "update"),
  validate({ params: departmentIdParamsSchema, body: updateDepartmentSchema }),
  departmentsController.updateDepartment
);
departmentsRouter.delete(
  "/:id",
  authorize("departments", "delete"),
  validate({ params: departmentIdParamsSchema }),
  departmentsController.deleteDepartment
);
departmentsRouter.post(
  "/:id/restore",
  requireAdmin,
  validate({ params: departmentIdParamsSchema }),
  departmentsController.restoreDepartment
);
