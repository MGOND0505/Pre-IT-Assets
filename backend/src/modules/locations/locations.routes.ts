import { Router } from "express";
import { authorize, requireAdmin, requireModuleEnabled } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { uploadSpreadsheet } from "../../utils/upload";
import * as locationsController from "./locations.controller";
import {
  previewLocationImport,
  confirmLocationImport,
  downloadLocationTemplate,
  getLocationImportHistory,
} from "./locations.import";
import {
  confirmLocationImportSchema,
  createLocationSchema,
  listLocationsQuerySchema,
  locationIdParamsSchema,
  updateLocationSchema,
} from "./locations.validation";
import { listImportHistoryQuerySchema } from "../importHistory/importHistory.validation";

export const locationsRouter = Router();

// Mounted ahead of the generic "/:id" routes below, same ordering assets.routes.ts uses for its
// own "/import/*" routes, so Express never mistakes "import" for an :id value.
locationsRouter.post(
  "/import/preview",
  authorize("locations", "import"),
  uploadSpreadsheet.single("file"),
  previewLocationImport
);
locationsRouter.post(
  "/import/confirm",
  authorize("locations", "import"),
  validate({ body: confirmLocationImportSchema }),
  confirmLocationImport
);
locationsRouter.get("/import/template", authorize("locations", "import"), downloadLocationTemplate);
locationsRouter.get(
  "/import/history",
  authorize("locations", "import"),
  validate({ query: listImportHistoryQuerySchema }),
  getLocationImportHistory
);

locationsRouter.get(
  "/deleted",
  requireAdmin,
  requireModuleEnabled("recycleBin"),
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
  requireModuleEnabled("recycleBin"),
  validate({ params: locationIdParamsSchema }),
  locationsController.restoreLocation
);
