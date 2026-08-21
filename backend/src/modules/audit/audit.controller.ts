import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { listAuditLogs } from "./audit.service";
import { listAllLoginHistory } from "../users/loginHistory.service";

export const getAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await listAuditLogs({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    module: typeof req.query.module === "string" ? req.query.module : undefined,
    action: typeof req.query.action === "string" ? req.query.action : undefined,
  });

  ok(res, result, "Audit logs");
});

export const getLoginHistory = asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const result = await listAllLoginHistory(page, limit);

  ok(res, result, "Login history");
});
