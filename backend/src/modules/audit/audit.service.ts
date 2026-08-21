import type { Request } from "express";
import { AuditLog } from "../../models/AuditLog";
import { User } from "../../models/User";

type LogActionInput = {
  req: Request;
  action: string;
  module: string;
  recordId?: string | null;
  recordLabel?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
};

export async function logAction({
  req,
  action,
  module,
  recordId = null,
  recordLabel = null,
  oldValue = null,
  newValue = null,
}: LogActionInput): Promise<void> {
  let userSnapshot = { name: null as string | null, email: null as string | null, role: null as string | null };

  if (req.user) {
    const user = await User.findById(req.user.id).select("name email");
    if (user) {
      userSnapshot = { name: user.name, email: user.email, role: req.user.roleNames.join(", ") };
    }
  }

  await AuditLog.create({
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
}) {
  const page = query.page && query.page > 0 ? query.page : 1;
  const limit = query.limit && query.limit > 0 && query.limit <= 100 ? query.limit : 20;

  const filter: Record<string, unknown> = {};
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
