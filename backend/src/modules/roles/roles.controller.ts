import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as rolesService from "./roles.service";

export const listRoles = asyncHandler(async (req: Request, res: Response) => {
  const result = await rolesService.listRoles(req.query as never, req.organization!._id);
  ok(res, result, "Roles");
});

export const getRole = asyncHandler(async (req: Request, res: Response) => {
  const role = await rolesService.getRoleById(req.params.id, req.organization!._id);
  ok(res, role, "Role");
});

export const createRole = asyncHandler(async (req: Request, res: Response) => {
  const role = await rolesService.createRole(req.body, req.organization!._id);

  await logAction({
    req,
    action: "CREATE",
    module: "Role",
    recordId: role.id,
    recordLabel: role.name,
    newValue: req.body,
  });

  ok(res, role, "Role created", 201);
});

export const updateRole = asyncHandler(async (req: Request, res: Response) => {
  const before = await rolesService.getRoleById(req.params.id, req.organization!._id);
  const oldValue = {
    name: before.name,
    description: before.description,
    portalType: before.portalType,
    status: before.status,
  };

  const role = await rolesService.updateRole(req.params.id, req.body, req.organization!._id);

  await logAction({
    req,
    action: "UPDATE",
    module: "Role",
    recordId: role.id,
    recordLabel: role.name,
    oldValue,
    newValue: req.body,
  });

  ok(res, role, "Role updated");
});

export const deleteRole = asyncHandler(async (req: Request, res: Response) => {
  const role = await rolesService.deleteRole(req.params.id, req.user!.id, req.organization!._id);

  await logAction({
    req,
    action: "DELETE",
    module: "Role",
    recordId: req.params.id,
    recordLabel: role.name,
  });

  ok(res, null, "Role deleted");
});

export const listDeletedRoles = asyncHandler(async (req: Request, res: Response) => {
  const result = await rolesService.listRoles(
    { ...(req.query as unknown as Record<string, unknown>), includeDeleted: true },
    req.organization!._id
  );
  ok(res, result, "Deleted roles");
});

export const restoreRole = asyncHandler(async (req: Request, res: Response) => {
  const role = await rolesService.restoreRole(req.params.id, req.organization!._id);

  await logAction({ req, action: "RESTORE", module: "Role", recordId: role.id, recordLabel: role.name });

  ok(res, role, "Role restored");
});
