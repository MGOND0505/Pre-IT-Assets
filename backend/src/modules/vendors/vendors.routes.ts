import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as vendorsController from "./vendors.controller";
import {
  createVendorSchema,
  listVendorsQuerySchema,
  updateVendorSchema,
  vendorIdParamsSchema,
} from "./vendors.validation";

export const vendorsRouter = Router();

vendorsRouter.use(authenticate);

vendorsRouter.get("/", validate({ query: listVendorsQuerySchema }), vendorsController.listVendors);
vendorsRouter.post("/", requireAdmin, validate({ body: createVendorSchema }), vendorsController.createVendor);
vendorsRouter.get("/:id", validate({ params: vendorIdParamsSchema }), vendorsController.getVendor);
vendorsRouter.put(
  "/:id",
  requireAdmin,
  validate({ params: vendorIdParamsSchema, body: updateVendorSchema }),
  vendorsController.updateVendor
);
vendorsRouter.delete(
  "/:id",
  requireAdmin,
  validate({ params: vendorIdParamsSchema }),
  vendorsController.deleteVendor
);
