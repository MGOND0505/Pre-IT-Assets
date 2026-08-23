import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as locationsController from "./locations.controller";
import {
  createLocationSchema,
  listLocationsQuerySchema,
  locationIdParamsSchema,
  updateLocationSchema,
} from "./locations.validation";

export const locationsRouter = Router();

locationsRouter.use(authenticate);

locationsRouter.get("/", validate({ query: listLocationsQuerySchema }), locationsController.listLocations);
locationsRouter.post("/", requireAdmin, validate({ body: createLocationSchema }), locationsController.createLocation);
locationsRouter.get("/:id", validate({ params: locationIdParamsSchema }), locationsController.getLocation);
locationsRouter.put(
  "/:id",
  requireAdmin,
  validate({ params: locationIdParamsSchema, body: updateLocationSchema }),
  locationsController.updateLocation
);
locationsRouter.delete(
  "/:id",
  requireAdmin,
  validate({ params: locationIdParamsSchema }),
  locationsController.deleteLocation
);
