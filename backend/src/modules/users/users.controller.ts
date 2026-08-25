import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as usersService from "./users.service";
import { listLoginHistoryForUser } from "./loginHistory.service";

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.createUser({ ...req.body, createdBy: req.user!.id }, req.organization!._id);

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
  const result = await usersService.listUsers(req.query as never, req.organization!._id);
  ok(res, result, "Users");
});

export const getUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.getUserById(req.params.id, req.organization!._id);
  ok(res, user, "User");
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organization!._id;
  const before = await usersService.getUserById(req.params.id, organizationId);
  const oldValue = { name: before.name, designation: before.designation, phone: before.phone };

  const user = await usersService.updateUser(req.params.id, req.body, organizationId);

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
  const organizationId = req.organization!._id;
  const before = await usersService.getUserById(req.params.id, organizationId);
  const oldValue = { isAdmin: before.isAdmin, permissions: before.permissions };

  const user = await usersService.updateUserPermissions(req.params.id, req.body, organizationId);

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
  const user = await usersService.setUserStatus(req.params.id, "Active", req.organization!._id);

  await logAction({ req, action: "ACTIVATE", module: "User", recordId: user.id, recordLabel: user.email });

  ok(res, user, "User activated");
});

export const deactivateUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.setUserStatus(req.params.id, "Inactive", req.organization!._id);

  await logAction({ req, action: "DEACTIVATE", module: "User", recordId: user.id, recordLabel: user.email });

  ok(res, user, "User deactivated");
});

export const adminResetPassword = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.adminResetPassword(req.params.id, req.body.newPassword, req.organization!._id);

  await logAction({ req, action: "ADMIN_RESET_PASSWORD", module: "User", recordId: user.id, recordLabel: user.email });

  ok(res, null, "Password has been reset");
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  const snapshot = await usersService.deleteUser(req.params.id, req.user!.id, req.organization!._id);

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

export const listDeletedUsers = asyncHandler(async (req: Request, res: Response) => {
  const result = await usersService.listUsers(
    { ...(req.query as unknown as Record<string, unknown>), includeDeleted: true },
    req.organization!._id
  );
  ok(res, result, "Deleted users");
});

export const restoreUser = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.restoreUser(req.params.id, req.organization!._id);

  await logAction({ req, action: "RESTORE", module: "User", recordId: user.id, recordLabel: user.email });

  ok(res, user, "User restored");
});

export const getUserLoginHistory = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organization!._id;
  // Confirms the target user actually belongs to this org before returning anything -
  // otherwise an Admin could pull another organization's user's login history by guessing an id.
  await usersService.getUserById(req.params.id, organizationId);

  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const result = await listLoginHistoryForUser(req.params.id, organizationId, page, limit);
  ok(res, result, "Login history");
});
