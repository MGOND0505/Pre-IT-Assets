import { Router } from "express";
import { authorize, requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as vendorsController from "./vendors.controller";
import {
  createVendorSchema,
  listVendorsQuerySchema,
  updateVendorSchema,
  vendorIdParamsSchema,
} from "./vendors.validation";

export const vendorsRouter = Router();

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
