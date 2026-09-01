import { LoginHistory } from "../../models/LoginHistory";

export async function listLoginHistoryForUser(userId: string, organizationId: string, page = 1, limit = 20) {
  const filter = { user: userId, organization: organizationId };

  const [items, total] = await Promise.all([
    LoginHistory.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    LoginHistory.countDocuments(filter),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function listAllLoginHistory(organizationId: string, page = 1, limit = 20) {
  const filter: Record<string, unknown> = { organization: organizationId };

  const [items, total] = await Promise.all([
    LoginHistory.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    LoginHistory.countDocuments(filter),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

/** The Super Admin panel's flat, cross-organization login history - same "optional organizationId"
 * shape as audit.service.ts#listAuditLogsAcrossOrgs: given, narrows to one org; omitted, spans
 * every organization including the org-agnostic superAdmin login flow (organization: null - see
 * the model's own comment). Populates `organization` so a flat list can label each row "Platform"
 * or the actual org. Leaves listAllLoginHistory completely untouched - strictly additive. */
export async function listAllLoginHistoryAcrossOrgs(page = 1, limit = 20, organizationId?: string) {
  const filter: Record<string, unknown> = {};
  if (organizationId) filter.organization = organizationId;

  const [items, total] = await Promise.all([
    LoginHistory.find(filter)
      .populate("organization", "name slug")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    LoginHistory.countDocuments(filter),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}
