import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { listAuditLogsAcrossOrgs } from "../audit/audit.service";
import { listAllLoginHistoryAcrossOrgs } from "../users/loginHistory.service";

export const listGlobalAuditLogs = asyncHandler(async (req: Request, res: Response) => {
  const result = await listAuditLogsAcrossOrgs({
    page: req.query.page ? Number(req.query.page) : undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    module: typeof req.query.module === "string" ? req.query.module : undefined,
    action: typeof req.query.action === "string" ? req.query.action : undefined,
    organizationId: typeof req.query.organizationId === "string" ? req.query.organizationId : undefined,
  });

  ok(res, result, "Audit logs");
});

export const listGlobalLoginHistory = asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const organizationId = typeof req.query.organizationId === "string" ? req.query.organizationId : undefined;
  const result = await listAllLoginHistoryAcrossOrgs(page, limit, organizationId);

  ok(res, result, "Login history");
});
