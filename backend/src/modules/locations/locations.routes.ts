import { Router } from "express";
import { authorize, requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as locationsController from "./locations.controller";
import {
  createLocationSchema,
  listLocationsQuerySchema,
  locationIdParamsSchema,
  updateLocationSchema,
} from "./locations.validation";

export const locationsRouter = Router();

locationsRouter.get(
  "/deleted",
  requireAdmin,
  validate({ query: listLocationsQuerySchema }),
  locationsController.listDeletedLocations
);
locationsRouter.get(
  "/",
  authorize("locations", "view"),
  validate({ query: listLocationsQuerySchema }),
  locationsController.listLocations
);
locationsRouter.post(
  "/",
  authorize("locations", "create"),
  validate({ body: createLocationSchema }),
  locationsController.createLocation
);
locationsRouter.get(
  "/:id",
  authorize("locations", "view"),
  validate({ params: locationIdParamsSchema }),
  locationsController.getLocation
);
locationsRouter.put(
  "/:id",
  authorize("locations", "update"),
  validate({ params: locationIdParamsSchema, body: updateLocationSchema }),
  locationsController.updateLocation
);
locationsRouter.delete(
  "/:id",
  authorize("locations", "delete"),
  validate({ params: locationIdParamsSchema }),
  locationsController.deleteLocation
);
locationsRouter.post(
  "/:id/restore",
  requireAdmin,
  validate({ params: locationIdParamsSchema }),
  locationsController.restoreLocation
);
