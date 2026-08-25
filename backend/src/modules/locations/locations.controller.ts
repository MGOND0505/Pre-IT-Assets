import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as locationsService from "./locations.service";

export const listLocations = asyncHandler(async (req: Request, res: Response) => {
  const result = await locationsService.listLocations(req.query as never, req.organization!._id);
  ok(res, result, "Locations");
});

export const getLocation = asyncHandler(async (req: Request, res: Response) => {
  const location = await locationsService.getLocationById(req.params.id, req.organization!._id);
  ok(res, location, "Location");
});

export const createLocation = asyncHandler(async (req: Request, res: Response) => {
  const location = await locationsService.createLocation(req.body, req.organization!._id);

  await logAction({
    req,
    action: "CREATE",
    module: "Location",
    recordId: location.id,
    recordLabel: location.name,
    newValue: req.body,
  });

  ok(res, location, "Location created", 201);
});

export const updateLocation = asyncHandler(async (req: Request, res: Response) => {
  const before = await locationsService.getLocationById(req.params.id, req.organization!._id);
  const oldValue = {
    name: before.name,
    address: before.address,
    city: before.city,
    state: before.state,
    country: before.country,
    status: before.status,
  };

  const location = await locationsService.updateLocation(req.params.id, req.body, req.organization!._id);

  await logAction({
    req,
    action: "UPDATE",
    module: "Location",
    recordId: location.id,
    recordLabel: location.name,
    oldValue,
    newValue: req.body,
  });

  ok(res, location, "Location updated");
});

export const deleteLocation = asyncHandler(async (req: Request, res: Response) => {
  const location = await locationsService.deleteLocation(req.params.id, req.user!.id, req.organization!._id);

  await logAction({
    req,
    action: "DELETE",
    module: "Location",
    recordId: req.params.id,
    recordLabel: location.name,
  });

  ok(res, null, "Location deleted");
});

export const listDeletedLocations = asyncHandler(async (req: Request, res: Response) => {
  const result = await locationsService.listLocations(
    { ...(req.query as unknown as Record<string, unknown>), includeDeleted: true },
    req.organization!._id
  );
  ok(res, result, "Deleted locations");
});

export const restoreLocation = asyncHandler(async (req: Request, res: Response) => {
  const location = await locationsService.restoreLocation(req.params.id, req.organization!._id);

  await logAction({ req, action: "RESTORE", module: "Location", recordId: location.id, recordLabel: location.name });

  ok(res, location, "Location restored");
});
