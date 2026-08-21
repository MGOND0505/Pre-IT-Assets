import type { NextFunction, Request, Response } from "express";
import type { PermissionKey } from "../config/permissionCatalog";
import { permissionSetHas } from "../utils/rbac";
import { ApiError } from "../utils/ApiError";

export function authorize(...required: PermissionKey[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new ApiError(401, "Not authenticated"));
    }

    const allowed = required.every((key) => permissionSetHas(req.user!.permissions, key));

    if (!allowed) {
      return next(new ApiError(403, "You do not have permission to perform this action"));
    }

    next();
  };
}
