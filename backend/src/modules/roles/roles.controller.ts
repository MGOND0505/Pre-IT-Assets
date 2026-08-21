import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as rolesService from "./roles.service";

export const getRoles = asyncHandler(async (_req: Request, res: Response) => {
  const roles = await rolesService.listRoles();
  ok(res, roles, "Roles");
});

export const getRole = asyncHandler(async (req: Request, res: Response) => {
  const role = await rolesService.getRoleById(req.params.id);
  ok(res, role, "Role");
});

export const createRole = asyncHandler(async (req: Request, res: Response) => {
  const role = await rolesService.createRole({
    ...req.body,
    actorPermissions: req.user!.permissions,
    actorIsSuperAdmin: req.user!.isSuperAdmin,
  });

  await logAction({
    req,
    action: "CREATE",
    module: "Role",
    recordId: role.id,
    recordLabel: role.name,
    newValue: { name: role.name, permissionKeys: req.body.permissionKeys },
  });

  ok(res, role, "Role created", 201);
});

export const updateRole = asyncHandler(async (req: Request, res: Response) => {
  const before = await rolesService.getRoleById(req.params.id);
  const oldValue = {
    name: before.name,
    permissions: (before.permissions as unknown as Array<{ key: string }>).map((p) => p.key),
  };

  const role = await rolesService.updateRole(req.params.id, req.body, req.user!.permissions, req.user!.isSuperAdmin);

  await logAction({
    req,
    action: req.body.permissionKeys !== undefined ? "PERMISSIONS_CHANGED" : "UPDATE",
    module: "Role",
    recordId: role.id,
    recordLabel: role.name,
    oldValue,
    newValue: req.body,
  });

  ok(res, role, "Role updated");
});

export const deleteRole = asyncHandler(async (req: Request, res: Response) => {
  const role = await rolesService.deleteRole(req.params.id);

  await logAction({
    req,
    action: "DELETE",
    module: "Role",
    recordId: role.id,
    recordLabel: role.name,
    oldValue: { name: role.name },
  });

  ok(res, null, "Role deleted");
});

export const getUsersByRole = asyncHandler(async (req: Request, res: Response) => {
  const users = await rolesService.listUsersByRole(req.params.id);
  ok(res, users, "Users with this role");
});
