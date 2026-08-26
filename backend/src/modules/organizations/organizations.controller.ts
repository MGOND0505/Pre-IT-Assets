import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as organizationsService from "./organizations.service";

export const listOrganizations = asyncHandler(async (req: Request, res: Response) => {
  const result = await organizationsService.listOrganizationsWithStats(req.query as never);
  ok(res, result, "Organizations");
});

export const getDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const { days, organizationId } = req.query as unknown as { days?: number; organizationId?: string };
  const stats = await organizationsService.getSuperAdminDashboardStats({ days, organizationId });
  ok(res, stats, "Dashboard stats");
});

export const globalSearch = asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query as unknown as { q: string };
  const results = await organizationsService.searchAllOrganizations(q);
  ok(res, results, "Search results");
});

export const createOrganization = asyncHandler(async (req: Request, res: Response) => {
  const org = await organizationsService.createOrganization(req.body, req.user!.id);

  await logAction({
    req,
    action: "CREATE",
    module: "Organization",
    recordId: org.id,
    recordLabel: org.name,
    newValue: { name: org.name, slug: org.slug },
    organizationId: org.id,
  });

  ok(res, org, "Organization created", 201);
});

export const getOrganization = asyncHandler(async (req: Request, res: Response) => {
  const details = await organizationsService.getOrganizationDetails(req.params.idOrSlug);
  ok(res, details, "Organization details");
});

export const updateOrganization = asyncHandler(async (req: Request, res: Response) => {
  const before = await organizationsService.getOrganizationDetails(req.params.idOrSlug);
  const org = await organizationsService.updateOrganization(req.params.idOrSlug, req.body);

  await logAction({
    req,
    action: "UPDATE",
    module: "Organization",
    recordId: org.id,
    recordLabel: org.name,
    oldValue: before.organization.toObject(),
    newValue: req.body,
    organizationId: org.id,
  });

  ok(res, org, "Organization updated");
});

export const setOrganizationStatus = asyncHandler(async (req: Request, res: Response) => {
  const org = await organizationsService.setOrganizationStatus(req.params.idOrSlug, req.body.status);

  await logAction({
    req,
    action: req.body.status === "Active" ? "REACTIVATE" : "SUSPEND",
    module: "Organization",
    recordId: org.id,
    recordLabel: org.name,
    newValue: { status: org.status },
    organizationId: org.id,
  });

  ok(res, org, "Organization status updated");
});

export const listDeletedOrganizations = asyncHandler(async (req: Request, res: Response) => {
  const result = await organizationsService.listDeletedOrganizations(req.query as never);
  ok(res, result, "Deleted organizations");
});

export const deleteOrganization = asyncHandler(async (req: Request, res: Response) => {
  const org = await organizationsService.deleteOrganization(req.params.idOrSlug, req.user!.id);

  await logAction({
    req,
    action: "DELETE",
    module: "Organization",
    recordId: org.id,
    recordLabel: org.name,
    organizationId: org.id,
  });

  ok(res, null, "Organization deleted");
});

export const restoreOrganization = asyncHandler(async (req: Request, res: Response) => {
  const org = await organizationsService.restoreOrganization(req.params.idOrSlug);

  await logAction({
    req,
    action: "RESTORE",
    module: "Organization",
    recordId: org.id,
    recordLabel: org.name,
    organizationId: org.id,
  });

  ok(res, org, "Organization restored");
});
