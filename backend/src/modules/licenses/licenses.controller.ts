import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import { validateCustomFieldValues } from "../customFieldDefinitions/customFieldValues.service";
import * as licensesService from "./licenses.service";

type ListLicensesQuery = Parameters<typeof licensesService.listLicenses>[1];

function requestingUserFrom(req: Request) {
  return { id: req.user!.id, isAdmin: req.user!.isAdmin, permissions: req.user!.permissions };
}

export const listLicenses = asyncHandler(async (req: Request, res: Response) => {
  const result = await licensesService.listLicenses(req.organization!._id, req.query as never, requestingUserFrom(req));
  ok(res, result, "Licenses");
});

export const getLicenseStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await licensesService.getLicenseStats(req.organization!._id);
  ok(res, stats, "License stats");
});

export const getMyLicenseSummary = asyncHandler(async (req: Request, res: Response) => {
  const summary = await licensesService.getMyLicenseSummary(req.organization!._id, req.user!.id);
  ok(res, summary, "My license summary");
});

export const listDeletedLicenses = asyncHandler(async (req: Request, res: Response) => {
  const result = await licensesService.listLicenses(
    req.organization!._id,
    { ...(req.query as unknown as ListLicensesQuery), includeDeleted: true },
    requestingUserFrom(req)
  );
  ok(res, result, "Deleted licenses");
});

export const getLicense = asyncHandler(async (req: Request, res: Response) => {
  const license = await licensesService.getLicenseByIdForRequester(req.organization!._id, req.params.id, requestingUserFrom(req));
  ok(res, license, "License");
});

/** Tagging a license to employee(s) (assignedUsers) is restricted to Org Admin/Super Admin - no
 * permissions.licenses.* bypass here, even for a Team Member holding licenses:update. Stripped
 * here so a direct API call can't set it either - mirrors assets.controller.ts's own
 * stripAssignedUserUnlessAdmin. */
function stripAssignedUsersUnlessAdmin(req: Request): void {
  if (!req.user!.isAdmin) delete req.body.assignedUsers;
}

export const createLicense = asyncHandler(async (req: Request, res: Response) => {
  stripAssignedUsersUnlessAdmin(req);
  req.body.customFields = await validateCustomFieldValues(req.body.customFields, "licenses", req.organization!._id);
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
  stripAssignedUsersUnlessAdmin(req);
  req.body.customFields = await validateCustomFieldValues(req.body.customFields, "licenses", req.organization!._id);
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
