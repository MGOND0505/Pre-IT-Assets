import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as licensesService from "./licenses.service";

type ListLicensesQuery = Parameters<typeof licensesService.listLicenses>[1];

export const listLicenses = asyncHandler(async (req: Request, res: Response) => {
  const result = await licensesService.listLicenses(req.organization!._id, req.query as never);
  ok(res, result, "Licenses");
});

export const getLicenseStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await licensesService.getLicenseStats(req.organization!._id);
  ok(res, stats, "License stats");
});

export const listDeletedLicenses = asyncHandler(async (req: Request, res: Response) => {
  const result = await licensesService.listLicenses(req.organization!._id, {
    ...(req.query as unknown as ListLicensesQuery),
    includeDeleted: true,
  });
  ok(res, result, "Deleted licenses");
});

export const getLicense = asyncHandler(async (req: Request, res: Response) => {
  const license = await licensesService.getLicenseById(req.organization!._id, req.params.id);
  ok(res, license, "License");
});

export const createLicense = asyncHandler(async (req: Request, res: Response) => {
  const license = await licensesService.createLicense(req.organization!._id, req.body, req.user!.id);

  await logAction({
    req,
    action: "CREATE",
    module: "License",
    recordId: license.id,
    recordLabel: license.licenseId,
    newValue: { softwareName: license.softwareName },
  });

  ok(res, license, "License created", 201);
});

export const updateLicense = asyncHandler(async (req: Request, res: Response) => {
  const license = await licensesService.updateLicense(req.organization!._id, req.params.id, req.body);

  await logAction({
    req,
    action: "UPDATE",
    module: "License",
    recordId: license.id,
    recordLabel: license.licenseId,
  });

  ok(res, license, "License updated");
});

export const deleteLicense = asyncHandler(async (req: Request, res: Response) => {
  const license = await licensesService.deleteLicense(req.organization!._id, req.params.id, req.user!.id);

  await logAction({
    req,
    action: "DELETE",
    module: "License",
    recordId: req.params.id,
    recordLabel: license.licenseId,
  });

  ok(res, null, "License deleted");
});

export const restoreLicense = asyncHandler(async (req: Request, res: Response) => {
  const license = await licensesService.restoreLicense(req.organization!._id, req.params.id);

  await logAction({ req, action: "RESTORE", module: "License", recordId: license.id, recordLabel: license.licenseId });

  ok(res, license, "License restored");
});
