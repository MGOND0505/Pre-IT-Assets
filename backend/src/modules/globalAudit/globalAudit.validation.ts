import { z } from "zod";

// Backs GET /api/audit-logs (globalAudit.routes.ts) - the flat, cross-organization Super Admin
// activity log. Same page/limit/module/action shape as the org-scoped audit.routes.ts's query
// (read directly off req.query there, no schema - this one adds a schema since it also carries
// the optional organizationId filter and is a brand new route worth validating from the start),
// plus an optional organizationId to narrow to one specific org - omitted, it spans every org.
export const listGlobalAuditLogsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  module: z.string().max(100).optional(),
  action: z.string().max(100).optional(),
  organizationId: z.string().min(1).optional(),
});

// Backs GET /api/audit-logs/login-history - same idea as above, mirroring the org-scoped login
// history endpoint's page/limit shape plus the optional organizationId filter.
export const listGlobalLoginHistoryQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  organizationId: z.string().min(1).optional(),
});
