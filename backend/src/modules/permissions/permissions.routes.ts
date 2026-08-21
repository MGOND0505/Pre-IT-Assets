import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { PERM } from "../../config/permissionCatalog";
import { Permission } from "../../models/Permission";

export const permissionsRouter = Router();

permissionsRouter.get(
  "/",
  authenticate,
  authorize(PERM.ROLES_READ),
  asyncHandler(async (_req, res) => {
    const permissions = await Permission.find().sort({ module: 1, action: 1 });
    ok(res, permissions, "Permission catalog");
  })
);
