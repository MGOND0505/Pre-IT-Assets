import type { Request } from "express";
import { AuditLog } from "../../models/AuditLog";
import { User } from "../../models/User";
import type { UserRole } from "../../models/User";

const ROLE_LABEL: Record<UserRole, string> = {
  superAdmin: "Super Admin",
  subSuperAdmin: "Sub-Super Admin",
  orgAdmin: "Org Admin",
  teamMember: "Team Member",
};

type LogActionInput = {
  req: Request;
  action: string;
  module: string;
  recordId?: string | null;
  recordLabel?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  /** Overrides the org this entry is attributed to - for the handful of flat, superAdmin-only
   * organization-management routes (edit/suspend), where req.organization is never set (they
   * aren't mounted under /api/:orgSlug) but the org being acted ON is still the meaningful
   * context, e.g. so a suspended org's own audit log shows why. */
  organizationId?: string | null;
};

export async function logAction({
  req,
  action,
  module,
  recordId = null,
  recordLabel = null,
  oldValue = null,
  newValue = null,
  organizationId,
}: LogActionInput): Promise<void> {
  let userSnapshot = { name: null as string | null, email: null as string | null, role: null as string | null };

  if (req.user) {
    const user = await User.findById(req.user.id).select("name email");
    if (user) {
      userSnapshot = { name: user.name, email: user.email, role: ROLE_LABEL[req.user.role] };
    }
  }

  await AuditLog.create({
    // req.organization reflects the request's actual target org (correct even for a
    // superAdmin acting on a different org than their own); falls back to the acting
    // user's own home org for the handful of flat, org-agnostic /api/auth/* actions where
    // no per-request org was resolved. Both are null for a superAdmin's own account actions.
    organization: organizationId !== undefined ? organizationId : (req.organization?._id ?? req.user?.organization ?? null),
    user: req.user?.id ?? null,
    userSnapshot,
    action,
    module,
    recordId,
    recordLabel,
    oldValue,
    newValue,
    ipAddress: req.ip ?? null,
    userAgent: req.get("user-agent") ?? null,
  });
}

export async function listAuditLogs(query: {
  page?: number;
  limit?: number;
  module?: string;
  action?: string;
  organizationId: string;
}) {
  const page = query.page && query.page > 0 ? query.page : 1;
  const limit = query.limit && query.limit > 0 && query.limit <= 100 ? query.limit : 20;

  const filter: Record<string, unknown> = { organization: query.organizationId };
  if (query.module) filter.module = query.module;
  if (query.action) filter.action = query.action;

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AuditLog.countDocuments(filter),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}
