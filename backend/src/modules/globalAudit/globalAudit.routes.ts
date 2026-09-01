import { Router } from "express";
import { validate } from "../../middleware/validate";
import * as globalAuditController from "./globalAudit.controller";
import { listGlobalAuditLogsQuerySchema, listGlobalLoginHistoryQuerySchema } from "./globalAudit.validation";

/** Mounted flat at /api/audit-logs, behind authenticate + requireSuperAdmin (see app.ts) - same
 * "no per-route authorize() needed, the mount already gates it" convention as
 * organizations.routes.ts/globalUsers.routes.ts/platformSettingsRouter. The Super Admin panel's
 * cross-organization activity log and login history (read-only, mirrors audit.routes.ts's
 * read-only-by-design shape - no PATCH/PUT/DELETE here either). Every org-scoped
 * /api/:orgSlug/audit-logs and /api/:orgSlug/login-history route stays completely untouched -
 * this is strictly additive, new surface only a superAdmin can reach. */
export const globalAuditRouter = Router();

globalAuditRouter.get(
  "/",
  validate({ query: listGlobalAuditLogsQuerySchema }),
  globalAuditController.listGlobalAuditLogs
);
globalAuditRouter.get(
  "/login-history",
  validate({ query: listGlobalLoginHistoryQuerySchema }),
  globalAuditController.listGlobalLoginHistory
);
