import { Router } from "express";
import { authorize, requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { uploadSpreadsheet } from "../../utils/upload";
import * as vendorsController from "./vendors.controller";
import { previewVendorImport, confirmVendorImport, downloadVendorTemplate, getVendorImportHistory } from "./vendors.import";
import {
  confirmVendorImportSchema,
  createVendorSchema,
  listVendorsQuerySchema,
  updateVendorSchema,
  vendorIdParamsSchema,
} from "./vendors.validation";
import { listImportHistoryQuerySchema } from "../importHistory/importHistory.validation";

export const vendorsRouter = Router();

// Mounted ahead of the generic "/:id" routes below, same ordering assets.routes.ts uses for its
// own "/import/*" routes, so Express never mistakes "import" for an :id value.
vendorsRouter.post("/import/preview", authorize("vendors", "import"), uploadSpreadsheet.single("file"), previewVendorImport);
vendorsRouter.post(
  "/import/confirm",
  authorize("vendors", "import"),
  validate({ body: confirmVendorImportSchema }),
  confirmVendorImport
);
vendorsRouter.get("/import/template", authorize("vendors", "import"), downloadVendorTemplate);
vendorsRouter.get(
  "/import/history",
  authorize("vendors", "import"),
  validate({ query: listImportHistoryQuerySchema }),
  getVendorImportHistory
);

vendorsRouter.get(
  "/deleted",
  requireAdmin,
  validate({ query: listVendorsQuerySchema }),
  vendorsController.listDeletedVendors
);
vendorsRouter.get(
  "/",
  authorize("vendors", "view"),
  validate({ query: listVendorsQuerySchema }),
  vendorsController.listVendors
);
vendorsRouter.post(
  "/",
  authorize("vendors", "create"),
  validate({ body: createVendorSchema }),
  vendorsController.createVendor
);
vendorsRouter.get(
  "/:id",
  authorize("vendors", "view"),
  validate({ params: vendorIdParamsSchema }),
  vendorsController.getVendor
);
vendorsRouter.put(
  "/:id",
  authorize("vendors", "update"),
  validate({ params: vendorIdParamsSchema, body: updateVendorSchema }),
  vendorsController.updateVendor
);
vendorsRouter.delete(
  "/:id",
  authorize("vendors", "delete"),
  validate({ params: vendorIdParamsSchema }),
  vendorsController.deleteVendor
);
vendorsRouter.post(
  "/:id/restore",
  requireAdmin,
  validate({ params: vendorIdParamsSchema }),
  vendorsController.restoreVendor
);
