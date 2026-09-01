import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as designationsService from "./designations.service";

export const listDesignations = asyncHandler(async (req: Request, res: Response) => {
  const result = await designationsService.listDesignations(req.query as never, req.organization!._id);
  ok(res, result, "Designations");
});

export const getDesignation = asyncHandler(async (req: Request, res: Response) => {
  const designation = await designationsService.getDesignationById(req.params.id, req.organization!._id);
  ok(res, designation, "Designation");
});

export const createDesignation = asyncHandler(async (req: Request, res: Response) => {
  const designation = await designationsService.createDesignation(req.body, req.organization!._id);

  await logAction({
    req,
    action: "CREATE",
    module: "Designation",
    recordId: designation.id,
    recordLabel: designation.name,
    newValue: req.body,
  });

  ok(res, designation, "Designation created", 201);
});

export const updateDesignation = asyncHandler(async (req: Request, res: Response) => {
  const before = await designationsService.getDesignationById(req.params.id, req.organization!._id);
  const oldValue = { name: before.name, description: before.description, status: before.status };

  const designation = await designationsService.updateDesignation(req.params.id, req.body, req.organization!._id);

  await logAction({
    req,
    action: "UPDATE",
    module: "Designation",
    recordId: designation.id,
    recordLabel: designation.name,
    oldValue,
    newValue: req.body,
  });

  ok(res, designation, "Designation updated");
});

export const deleteDesignation = asyncHandler(async (req: Request, res: Response) => {
  const designation = await designationsService.deleteDesignation(req.params.id, req.user!.id, req.organization!._id);

  await logAction({
    req,
    action: "DELETE",
    module: "Designation",
    recordId: req.params.id,
    recordLabel: designation.name,
  });

  ok(res, null, "Designation deleted");
});

export const listDeletedDesignations = asyncHandler(async (req: Request, res: Response) => {
  const result = await designationsService.listDesignations(
    { ...(req.query as unknown as Record<string, unknown>), includeDeleted: true },
    req.organization!._id
  );
  ok(res, result, "Deleted designations");
});

export const restoreDesignation = asyncHandler(async (req: Request, res: Response) => {
  const designation = await designationsService.restoreDesignation(req.params.id, req.organization!._id);

  await logAction({ req, action: "RESTORE", module: "Designation", recordId: designation.id, recordLabel: designation.name });

  ok(res, designation, "Designation restored");
});
