import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { PERM } from "../../config/permissionCatalog";
import * as locationsController from "./locations.controller";
import {
  createLocationSchema,
  listLocationsQuerySchema,
  locationIdParamsSchema,
  updateLocationSchema,
} from "./locations.validation";

export const locationsRouter = Router();

locationsRouter.use(authenticate);

locationsRouter.get(
  "/",
  authorize(PERM.LOCATIONS_READ),
  validate({ query: listLocationsQuerySchema }),
  locationsController.listLocations
);
locationsRouter.post(
  "/",
  authorize(PERM.LOCATIONS_CREATE),
  validate({ body: createLocationSchema }),
  locationsController.createLocation
);
locationsRouter.get(
  "/:id",
  authorize(PERM.LOCATIONS_READ),
  validate({ params: locationIdParamsSchema }),
  locationsController.getLocation
);
locationsRouter.put(
  "/:id",
  authorize(PERM.LOCATIONS_WRITE),
  validate({ params: locationIdParamsSchema, body: updateLocationSchema }),
  locationsController.updateLocation
);
locationsRouter.delete(
  "/:id",
  authorize(PERM.LOCATIONS_DELETE),
  validate({ params: locationIdParamsSchema }),
  locationsController.deleteLocation
);
