import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { ApiError } from "../../utils/ApiError";
import { logAction } from "../audit/audit.service";
import * as accessRequestsService from "./accessRequests.service";

export const createAccessRequest = asyncHandler(async (req: Request, res: Response) => {
  if (req.user!.role !== "subSuperAdmin") {
    throw new ApiError(403, "Only a Sub-Super Admin can request organization access");
  }
  const request = await accessRequestsService.createAccessRequest(req.user!.id, req.body);
  ok(res, request, "Access request submitted", 201);
});

export const listAccessRequests = asyncHandler(async (req: Request, res: Response) => {
  const requests =
    req.user!.role === "superAdmin"
      ? await accessRequestsService.listAllAccessRequests()
      : await accessRequestsService.listMyAccessRequests(req.user!.id);
  ok(res, requests, "Access requests");
});

export const listBrowsableOrganizations = asyncHandler(async (_req: Request, res: Response) => {
  const organizations = await accessRequestsService.listBrowsableOrganizations();
  ok(res, organizations, "Organizations");
});

export const decideAccessRequest = asyncHandler(async (req: Request, res: Response) => {
  if (req.user!.role !== "superAdmin") {
    throw new ApiError(403, "Super Admin access required");
  }
  const { request, organizationId } = await accessRequestsService.decideAccessRequest(
    req.params.id,
    req.body.decision,
    req.user!.id
  );

  await logAction({
    req,
    action: req.body.decision === "Approved" ? "APPROVE_ACCESS_REQUEST" : "DENY_ACCESS_REQUEST",
    module: "AccessRequest",
    recordId: req.params.id,
    organizationId,
  });

  ok(res, request, "Access request updated");
});
