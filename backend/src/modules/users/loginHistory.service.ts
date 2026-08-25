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
