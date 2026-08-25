import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as subSuperAdminsService from "./subSuperAdmins.service";

export const createSubSuperAdmin = asyncHandler(async (req: Request, res: Response) => {
  const user = await subSuperAdminsService.createSubSuperAdmin({ ...req.body, createdBy: req.user!.id });

  await logAction({
    req,
    action: "CREATE",
    module: "SubSuperAdmin",
    recordId: user.id,
    recordLabel: user.email,
    newValue: { name: user.name, email: user.email, orgAccess: req.body.orgAccess },
  });

  ok(res, user, "Sub-Super Admin created", 201);
});

export const listSubSuperAdmins = asyncHandler(async (_req: Request, res: Response) => {
  const items = await subSuperAdminsService.listSubSuperAdmins();
  ok(res, items, "Sub-Super Admins");
});

export const getSubSuperAdmin = asyncHandler(async (req: Request, res: Response) => {
  const user = await subSuperAdminsService.getSubSuperAdminById(req.params.id);
  ok(res, user, "Sub-Super Admin");
});

export const updateSubSuperAdmin = asyncHandler(async (req: Request, res: Response) => {
  const user = await subSuperAdminsService.updateSubSuperAdmin(req.params.id, req.body);

  await logAction({
    req,
    action: "UPDATE",
    module: "SubSuperAdmin",
    recordId: user.id,
    recordLabel: user.email,
    newValue: req.body,
  });

  ok(res, user, "Sub-Super Admin updated");
});

export const updateSubSuperAdminAccess = asyncHandler(async (req: Request, res: Response) => {
  const user = await subSuperAdminsService.updateSubSuperAdminAccess(req.params.id, req.body.orgAccess);

  await logAction({
    req,
    action: "PERMISSIONS_UPDATED",
    module: "SubSuperAdmin",
    recordId: user.id,
    recordLabel: user.email,
    newValue: { orgAccess: req.body.orgAccess },
  });

  ok(res, user, "Access updated");
});

export const setSubSuperAdminStatus = asyncHandler(async (req: Request, res: Response) => {
  const user = await subSuperAdminsService.setSubSuperAdminStatus(req.params.id, req.body.status);

  await logAction({
    req,
    action: req.body.status === "Active" ? "ACTIVATE" : "DEACTIVATE",
    module: "SubSuperAdmin",
    recordId: user.id,
    recordLabel: user.email,
  });

  ok(res, user, "Status updated");
});

export const resetSubSuperAdminPassword = asyncHandler(async (req: Request, res: Response) => {
  const user = await subSuperAdminsService.resetSubSuperAdminPassword(req.params.id, req.body.newPassword);

  await logAction({
    req,
    action: "ADMIN_RESET_PASSWORD",
    module: "SubSuperAdmin",
    recordId: user.id,
    recordLabel: user.email,
  });

  ok(res, null, "Password has been reset");
});

export const deleteSubSuperAdmin = asyncHandler(async (req: Request, res: Response) => {
  const snapshot = await subSuperAdminsService.deleteSubSuperAdmin(req.params.id, req.user!.id);

  await logAction({
    req,
    action: "DELETE",
    module: "SubSuperAdmin",
    recordId: req.params.id,
    recordLabel: snapshot.email,
    oldValue: snapshot,
  });

  ok(res, null, "Sub-Super Admin deleted");
});

export const listMyGrantedOrganizations = asyncHandler(async (req: Request, res: Response) => {
  const organizations = await subSuperAdminsService.listMyGrantedOrganizations(req.user!.id);
  ok(res, organizations, "My organizations");
});

export const updateMyGrantedOrganizationRetention = asyncHandler(async (req: Request, res: Response) => {
  const org = await subSuperAdminsService.updateGrantedOrganizationRetention(
    req.user!.id,
    req.params.id,
    req.body.recycleBinRetentionDays
  );

  await logAction({
    req,
    action: "RECYCLE_BIN_RETENTION_UPDATED",
    module: "Organization",
    recordId: org.id,
    recordLabel: org.name,
    newValue: { recycleBinRetentionDays: org.recycleBinRetentionDays },
    organizationId: org.id,
  });

  ok(res, org, "Recycle Bin retention updated");
});
