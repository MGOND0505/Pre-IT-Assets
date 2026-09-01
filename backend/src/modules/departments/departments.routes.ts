import { Router } from "express";
import { authorize, requireAdmin, requireModuleEnabled } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { uploadSpreadsheet } from "../../utils/upload";
import * as departmentsController from "./departments.controller";
import {
  previewDepartmentImport,
  confirmDepartmentImport,
  downloadDepartmentTemplate,
  getDepartmentImportHistory,
} from "./departments.import";
import {
  confirmDepartmentImportSchema,
  createDepartmentSchema,
  departmentIdParamsSchema,
  listDepartmentsQuerySchema,
  updateDepartmentSchema,
} from "./departments.validation";
import { listImportHistoryQuerySchema } from "../importHistory/importHistory.validation";

export const departmentsRouter = Router();

// Mounted ahead of the generic "/:id" routes below, same ordering assets.routes.ts uses for its
// own "/import/*" routes, so Express never mistakes "import" for an :id value.
departmentsRouter.post(
  "/import/preview",
  authorize("departments", "import"),
  uploadSpreadsheet.single("file"),
  previewDepartmentImport
);
departmentsRouter.post(
  "/import/confirm",
  authorize("departments", "import"),
  validate({ body: confirmDepartmentImportSchema }),
  confirmDepartmentImport
);
departmentsRouter.get("/import/template", authorize("departments", "import"), downloadDepartmentTemplate);
departmentsRouter.get(
  "/import/history",
  authorize("departments", "import"),
  validate({ query: listImportHistoryQuerySchema }),
  getDepartmentImportHistory
);

departmentsRouter.get(
  "/deleted",
  requireAdmin,
  requireModuleEnabled("recycleBin"),
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
  requireModuleEnabled("recycleBin"),
  validate({ params: departmentIdParamsSchema }),
  departmentsController.restoreDepartment
);
