import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as vendorsService from "./vendors.service";

export const listVendors = asyncHandler(async (req: Request, res: Response) => {
  const result = await vendorsService.listVendors(req.query as never, req.organization!._id);
  ok(res, result, "Vendors");
});

export const getVendor = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorsService.getVendorById(req.params.id, req.organization!._id);
  ok(res, vendor, "Vendor");
});

export const createVendor = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorsService.createVendor(req.body, req.organization!._id);

  await logAction({
    req,
    action: "CREATE",
    module: "Vendor",
    recordId: vendor.id,
    recordLabel: vendor.name,
    newValue: req.body,
  });

  ok(res, vendor, "Vendor created", 201);
});

export const updateVendor = asyncHandler(async (req: Request, res: Response) => {
  const before = await vendorsService.getVendorById(req.params.id, req.organization!._id);
  const oldValue = before.toObject();

  const vendor = await vendorsService.updateVendor(req.params.id, req.body, req.organization!._id);

  await logAction({
    req,
    action: "UPDATE",
    module: "Vendor",
    recordId: vendor.id,
    recordLabel: vendor.name,
    oldValue,
    newValue: req.body,
  });

  ok(res, vendor, "Vendor updated");
});

export const deleteVendor = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorsService.deleteVendor(req.params.id, req.user!.id, req.organization!._id);

  await logAction({
    req,
    action: "DELETE",
    module: "Vendor",
    recordId: req.params.id,
    recordLabel: vendor.name,
  });

  ok(res, null, "Vendor deleted");
});

export const listDeletedVendors = asyncHandler(async (req: Request, res: Response) => {
  const result = await vendorsService.listVendors(
    { ...(req.query as unknown as Record<string, unknown>), includeDeleted: true },
    req.organization!._id
  );
  ok(res, result, "Deleted vendors");
});

export const restoreVendor = asyncHandler(async (req: Request, res: Response) => {
  const vendor = await vendorsService.restoreVendor(req.params.id, req.organization!._id);

  await logAction({ req, action: "RESTORE", module: "Vendor", recordId: vendor.id, recordLabel: vendor.name });

  ok(res, vendor, "Vendor restored");
});
