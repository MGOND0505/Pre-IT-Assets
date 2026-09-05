import { HelpdeskCategory, type IHelpdeskCategory } from "../../models/HelpdeskCategory";
import { User } from "../../models/User";
import { ApiError } from "../../utils/ApiError";
import { getOrgRetentionDays, withRecycleBinMeta } from "../../utils/recycleBin";
import { tokenSearchFilter } from "../../utils/smartSearch";

/** A category's default agent is a standing configuration, not a live assignment - so unlike
 * assignTicket()'s guard, this deliberately does NOT reject someone currently on leave (they may
 * simply be away temporarily; the category mapping itself shouldn't need re-configuring for that). */
async function assertValidDefaultAgent(defaultAgent: string | null | undefined, organizationId: string) {
  if (!defaultAgent) return;
  const agent = await User.findOne({ _id: defaultAgent, organization: organizationId, status: "Active", isDeleted: false });
  if (!agent) throw new ApiError(400, "Default agent not found or not available");
}

type ListInput = { page?: number; limit?: number; search?: string; status?: "Active" | "Inactive"; includeDeleted?: boolean };

export async function listHelpdeskCategories(input: ListInput, organizationId: string) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = { organization: organizationId, isDeleted: input.includeDeleted ? true : false };
  if (input.status) filter.status = input.status;
  if (input.search) Object.assign(filter, tokenSearchFilter(["name"], input.search));

  const [items, total] = await Promise.all([
    HelpdeskCategory.find(filter)
      .populate("defaultAgent", "name")
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    HelpdeskCategory.countDocuments(filter),
  ]);

  const retentionDays = await getOrgRetentionDays(organizationId);
  return { items: withRecycleBinMeta(items, retentionDays), total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getHelpdeskCategoryById(id: string, organizationId: string) {
  const category = await HelpdeskCategory.findOne({ organization: organizationId, _id: id, isDeleted: false }).populate(
    "defaultAgent",
    "name"
  );
  if (!category) throw new ApiError(404, "Helpdesk category not found");
  return category;
}

async function assertUnique(organizationId: string, name?: string, excludeId?: string) {
  if (!name) return;
  const existing = await HelpdeskCategory.findOne({
    organization: organizationId,
    name,
    isDeleted: false,
    _id: { $ne: excludeId },
  });
  if (existing) throw new ApiError(409, "A helpdesk category with this name already exists");
}

export async function createHelpdeskCategory(
  input: { name: string; description?: string; defaultAgent?: string | null },
  organizationId: string
) {
  await assertUnique(organizationId, input.name);
  await assertValidDefaultAgent(input.defaultAgent, organizationId);
  return HelpdeskCategory.create({ organization: organizationId, ...input });
}

export async function updateHelpdeskCategory(
  id: string,
  input: Partial<{ name: string; description: string; defaultAgent: string | null; status: "Active" | "Inactive" }>,
  organizationId: string
) {
  const category = await getHelpdeskCategoryById(id, organizationId);
  await assertUnique(organizationId, input.name, id);
  await assertValidDefaultAgent(input.defaultAgent, organizationId);

  Object.assign(category, input);
  await category.save();
  return category;
}

/** Soft delete: hidden from normal listings but recoverable via the Recycle Bin. */
export async function deleteHelpdeskCategory(id: string, deletedBy: string, organizationId: string) {
  const category = await getHelpdeskCategoryById(id, organizationId);
  category.isDeleted = true;
  category.deletedAt = new Date();
  category.deletedBy = deletedBy as unknown as IHelpdeskCategory["deletedBy"];
  await category.save();
  return category;
}

export async function restoreHelpdeskCategory(id: string, organizationId: string) {
  const category = await HelpdeskCategory.findOne({ organization: organizationId, _id: id, isDeleted: true });
  if (!category) throw new ApiError(404, "Deleted helpdesk category not found");
  await assertUnique(organizationId, category.name, id);

  category.isDeleted = false;
  category.deletedAt = null;
  category.deletedBy = null;
  await category.save();
  return category;
}
