import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { requireAdmin } from "../../middleware/authorize";
import { getAuditLogs, getLoginHistory } from "./audit.controller";

export const auditRouter = Router();

// Read-only by design: no PATCH/PUT/DELETE routes are ever registered for audit logs.
auditRouter.get("/", authenticate, requireAdmin, getAuditLogs);

export const loginHistoryRouter = Router();
loginHistoryRouter.get("/", authenticate, requireAdmin, getLoginHistory);
