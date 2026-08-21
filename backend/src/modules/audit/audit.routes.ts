import { Router } from "express";
import { authenticate } from "../../middleware/authenticate";
import { authorize } from "../../middleware/authorize";
import { PERM } from "../../config/permissionCatalog";
import { getAuditLogs, getLoginHistory } from "./audit.controller";

export const auditRouter = Router();

// Read-only by design: no PATCH/PUT/DELETE routes are ever registered for audit logs.
auditRouter.get("/", authenticate, authorize(PERM.AUDIT_READ), getAuditLogs);

export const loginHistoryRouter = Router();
loginHistoryRouter.get("/", authenticate, authorize(PERM.AUDIT_READ), getLoginHistory);
