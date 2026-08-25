import { Router } from "express";
import { authorize } from "../../middleware/authorize";
import { getAuditLogs, getLoginHistory } from "./audit.controller";

export const auditRouter = Router();

// Read-only by design: no PATCH/PUT/DELETE routes are ever registered for audit logs.
auditRouter.get("/", authorize("auditLogs", "view"), getAuditLogs);

export const loginHistoryRouter = Router();
loginHistoryRouter.get("/", authorize("auditLogs", "view"), getLoginHistory);
