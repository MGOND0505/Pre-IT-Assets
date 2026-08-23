import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as usersService from "./users.service";

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.createUser({
    ...req.body,
    createdBy: req.user!.id,
  });

  await logAction({
    req,
    action: "CREATE",
    module: "User",
    recordId: user.id,
    recordLabel: user.email,
    newValue: { name: user.name, email: user.email, isAdmin: user.isAdmin },
  });

  ok(res, user, "User created", 201);
});

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const result = await usersService.listUsers(req.query as never);
  ok(res, result, "Users");
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.getUserById(req.params.id);
  ok(res, user, "User");
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const before = await usersService.getUserById(req.params.id);
  const oldValue = { name: before.name, designation: before.designation, phone: before.phone };

  const user = await usersService.updateUser(req.params.id, req.body);

  await logAction({
    req,
    action: "UPDATE",
    module: "User",
    recordId: user.id,
    recordLabel: user.email,
    oldValue,
    newValue: req.body,
  });

  ok(res, user, "User updated");
});

export const updateUserPermissions = asyncHandler(async (req: Request, res: Response) => {
  const before = await usersService.getUserById(req.params.id);
  const oldValue = { isAdmin: before.isAdmin, permissions: before.permissions };

  const user = await usersService.updateUserPermissions(req.params.id, req.body);

  await logAction({
    req,
    action: "PERMISSIONS_UPDATED",
    module: "User",
    recordId: user.id,
    recordLabel: user.email,
    oldValue,
    newValue: req.body,
  });

  ok(res, user, "Permissions updated");
});

export const activateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.setUserStatus(req.params.id, "Active");

  await logAction({ req, action: "ACTIVATE", module: "User", recordId: user.id, recordLabel: user.email });

  ok(res, user, "User activated");
});

export const deactivateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.setUserStatus(req.params.id, "Inactive");

  await logAction({ req, action: "DEACTIVATE", module: "User", recordId: user.id, recordLabel: user.email });

  ok(res, user, "User deactivated");
});

export const adminResetPassword = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.adminResetPassword(req.params.id, req.body.newPassword);

  await logAction({ req, action: "ADMIN_RESET_PASSWORD", module: "User", recordId: user.id, recordLabel: user.email });

  ok(res, null, "Password has been reset");
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const snapshot = await usersService.deleteUser(req.params.id, req.user!.id);

  await logAction({
    req,
    action: "DELETE",
    module: "User",
    recordId: req.params.id,
    recordLabel: snapshot.email,
    oldValue: snapshot,
  });

  ok(res, null, "User deleted");
});
