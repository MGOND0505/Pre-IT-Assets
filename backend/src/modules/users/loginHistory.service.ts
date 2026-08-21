import { LoginHistory } from "../../models/LoginHistory";

export async function listLoginHistoryForUser(userId: string, page = 1, limit = 20) {
  const filter = { user: userId };

  const [items, total] = await Promise.all([
    LoginHistory.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    LoginHistory.countDocuments(filter),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function listAllLoginHistory(page = 1, limit = 20) {
  const [items, total] = await Promise.all([
    LoginHistory.find()
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    LoginHistory.countDocuments(),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}
