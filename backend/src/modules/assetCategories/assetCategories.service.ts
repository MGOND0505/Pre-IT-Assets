import { AssetCategory } from "../../models/AssetCategory";
import { ApiError } from "../../utils/ApiError";
import { escapeRegex } from "../../utils/regex";

type ListInput = { page?: number; limit?: number; search?: string; status?: "Active" | "Inactive" };

export async function listAssetCategories(input: ListInput, organizationId: string) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = { organization: organizationId };
  if (input.status) filter.status = input.status;
  if (input.search) {
    const search = escapeRegex(input.search);
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { prefix: { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    AssetCategory.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    AssetCategory.countDocuments(filter),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getAssetCategoryById(id: string, organizationId: string) {
  const category = await AssetCategory.findOne({ organization: organizationId, _id: id });
  if (!category) throw new ApiError(404, "Asset category not found");
  return category;
}

async function assertUnique(organizationId: string, name?: string, prefix?: string, excludeId?: string) {
  if (name) {
    const existing = await AssetCategory.findOne({ organization: organizationId, name, _id: { $ne: excludeId } });
    if (existing) throw new ApiError(409, "An asset category with this name already exists");
  }
  if (prefix) {
    const existing = await AssetCategory.findOne({
      organization: organizationId,
      prefix: prefix.toUpperCase(),
      _id: { $ne: excludeId },
    });
    if (existing) throw new ApiError(409, "An asset category with this prefix already exists");
  }
}

export async function createAssetCategory(
  input: { name: string; prefix: string; description?: string },
  organizationId: string
) {
  await assertUnique(organizationId, input.name, input.prefix);
  return AssetCategory.create({ organization: organizationId, ...input });
}

export async function updateAssetCategory(
  id: string,
  input: Partial<{ name: string; prefix: string; description: string; status: "Active" | "Inactive" }>,
  organizationId: string
) {
  const category = await getAssetCategoryById(id, organizationId);
  await assertUnique(organizationId, input.name, input.prefix, id);

  Object.assign(category, input);
  await category.save();
  return category;
}

export async function deleteAssetCategory(id: string, organizationId: string) {
  const category = await getAssetCategoryById(id, organizationId);
  await category.deleteOne();
  return category;
}
