import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as departmentsController from "./departments.controller";
import {
  createDepartmentSchema,
  departmentIdParamsSchema,
  listDepartmentsQuerySchema,
  updateDepartmentSchema,
} from "./departments.validation";

export const departmentsRouter = Router();

departmentsRouter.use(authenticate);

departmentsRouter.get("/", validate({ query: listDepartmentsQuerySchema }), departmentsController.listDepartments);
departmentsRouter.post(
  "/",
  requireAdmin,
  validate({ body: createDepartmentSchema }),
  departmentsController.createDepartment
);
departmentsRouter.get(
  "/:id",
  validate({ params: departmentIdParamsSchema }),
  departmentsController.getDepartment
);
departmentsRouter.put(
  "/:id",
  requireAdmin,
  validate({ params: departmentIdParamsSchema, body: updateDepartmentSchema }),
  departmentsController.updateDepartment
);
departmentsRouter.delete(
  "/:id",
  requireAdmin,
  validate({ params: departmentIdParamsSchema }),
  departmentsController.deleteDepartment
);
