import { HelpdeskPriority, type IHelpdeskPriority } from "../../models/HelpdeskPriority";
import { ApiError } from "../../utils/ApiError";
import { getOrgRetentionDays, withRecycleBinMeta } from "../../utils/recycleBin";

type ListInput = {
  page?: number;
  limit?: number;
  search?: string;
  status?: "Active" | "Inactive";
  includeDeleted?: boolean;
};

export async function listHelpdeskPriorities(input: ListInput, organizationId: string) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = { organization: organizationId, isDeleted: input.includeDeleted ? true : false };
  if (input.status) filter.status = input.status;
  if (input.search) filter.name = { $regex: input.search, $options: "i" };

  const [items, total] = await Promise.all([
    HelpdeskPriority.find(filter)
      .sort({ order: 1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    HelpdeskPriority.countDocuments(filter),
  ]);

  const retentionDays = await getOrgRetentionDays(organizationId);
  return { items: withRecycleBinMeta(items, retentionDays), total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getHelpdeskPriorityById(id: string, organizationId: string) {
  const priority = await HelpdeskPriority.findOne({ organization: organizationId, _id: id, isDeleted: false });
  if (!priority) throw new ApiError(404, "Helpdesk priority not found");
  return priority;
}

async function assertUnique(organizationId: string, name?: string, excludeId?: string) {
  if (!name) return;
  const existing = await HelpdeskPriority.findOne({
    organization: organizationId,
    name,
    isDeleted: false,
    _id: { $ne: excludeId },
  });
  if (existing) throw new ApiError(409, "A helpdesk priority with this name already exists");
}

type CreateInput = {
  name: string;
  order?: number;
  color?: string;
  slaResponseMinutes: number;
  slaResolutionMinutes: number;
};

export async function createHelpdeskPriority(input: CreateInput, organizationId: string) {
  await assertUnique(organizationId, input.name);
  return HelpdeskPriority.create({ organization: organizationId, ...input });
}

export async function updateHelpdeskPriority(
  id: string,
  input: Partial<CreateInput & { status: "Active" | "Inactive" }>,
  organizationId: string
) {
  const priority = await getHelpdeskPriorityById(id, organizationId);
  await assertUnique(organizationId, input.name, id);

  Object.assign(priority, input);
  await priority.save();
  return priority;
}

export async function deleteHelpdeskPriority(id: string, deletedBy: string, organizationId: string) {
  const priority = await getHelpdeskPriorityById(id, organizationId);
  priority.isDeleted = true;
  priority.deletedAt = new Date();
  priority.deletedBy = deletedBy as unknown as IHelpdeskPriority["deletedBy"];
  await priority.save();
  return priority;
}

export async function restoreHelpdeskPriority(id: string, organizationId: string) {
  const priority = await HelpdeskPriority.findOne({ organization: organizationId, _id: id, isDeleted: true });
  if (!priority) throw new ApiError(404, "Deleted helpdesk priority not found");
  await assertUnique(organizationId, priority.name, id);

  priority.isDeleted = false;
  priority.deletedAt = null;
  priority.deletedBy = null;
  await priority.save();
  return priority;
}
