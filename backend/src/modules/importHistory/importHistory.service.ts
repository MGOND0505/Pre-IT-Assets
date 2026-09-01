import { ImportBatch } from "../../models/ImportBatch";
import { User } from "../../models/User";

type RecordImportBatchInput = {
  organizationId: string;
  module: string;
  userId: string | null | undefined;
  fileName?: string | null;
  counts: { total: number; added: number; updated: number; duplicates: number; invalid: number };
  errors: string[];
};

export async function recordImportBatch({
  organizationId,
  module,
  userId,
  fileName = null,
  counts,
  errors,
}: RecordImportBatchInput): Promise<void> {
  let performedBySnapshot = { name: null as string | null, email: null as string | null };

  if (userId) {
    const user = await User.findById(userId).select("name email");
    if (user) {
      performedBySnapshot = { name: user.name, email: user.email };
    }
  }

  await ImportBatch.create({
    organization: organizationId,
    module,
    performedBy: userId ?? null,
    performedBySnapshot,
    fileName,
    counts,
    errors,
  });
}

export async function listImportBatches(query: {
  organizationId: string;
  module: string;
  page?: number;
  limit?: number;
}) {
  const page = query.page && query.page > 0 ? query.page : 1;
  const limit = query.limit && query.limit > 0 && query.limit <= 100 ? query.limit : 20;

  const filter = { organization: query.organizationId, module: query.module };

  const [items, total] = await Promise.all([
    ImportBatch.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    ImportBatch.countDocuments(filter),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}
