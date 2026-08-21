import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { PERM } from "../../config/permissionCatalog";
import * as vendorsController from "./vendors.controller";
import {
  createVendorSchema,
  listVendorsQuerySchema,
  updateVendorSchema,
  vendorIdParamsSchema,
} from "./vendors.validation";

export const vendorsRouter = Router();

vendorsRouter.use(authenticate);

vendorsRouter.get(
  "/",
  authorize(PERM.VENDORS_READ),
  validate({ query: listVendorsQuerySchema }),
  vendorsController.listVendors
);
vendorsRouter.post(
  "/",
  authorize(PERM.VENDORS_CREATE),
  validate({ body: createVendorSchema }),
  vendorsController.createVendor
);
vendorsRouter.get(
  "/:id",
  authorize(PERM.VENDORS_READ),
  validate({ params: vendorIdParamsSchema }),
  vendorsController.getVendor
);
vendorsRouter.put(
  "/:id",
  authorize(PERM.VENDORS_WRITE),
  validate({ params: vendorIdParamsSchema, body: updateVendorSchema }),
  vendorsController.updateVendor
);
vendorsRouter.delete(
  "/:id",
  authorize(PERM.VENDORS_DELETE),
  validate({ params: vendorIdParamsSchema }),
  vendorsController.deleteVendor
);
