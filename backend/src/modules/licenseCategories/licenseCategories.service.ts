import { LicenseCategory } from "../../models/LicenseCategory";
import { ApiError } from "../../utils/ApiError";

type ListInput = { page?: number; limit?: number; search?: string; status?: "Active" | "Inactive" };

export async function listLicenseCategories(input: ListInput, organizationId: string) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = { organization: organizationId };
  if (input.status) filter.status = input.status;
  if (input.search) filter.name = { $regex: input.search, $options: "i" };

  const [items, total] = await Promise.all([
    LicenseCategory.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    LicenseCategory.countDocuments(filter),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getLicenseCategoryById(id: string, organizationId: string) {
  const category = await LicenseCategory.findOne({ organization: organizationId, _id: id });
  if (!category) throw new ApiError(404, "License category not found");
  return category;
}

export async function createLicenseCategory(input: { name: string; description?: string }, organizationId: string) {
  const existing = await LicenseCategory.findOne({ organization: organizationId, name: input.name });
  if (existing) throw new ApiError(409, "A license category with this name already exists");
  return LicenseCategory.create({ organization: organizationId, ...input });
}

export async function updateLicenseCategory(
  id: string,
  input: Partial<{ name: string; description: string; status: "Active" | "Inactive" }>,
  organizationId: string
) {
  const category = await getLicenseCategoryById(id, organizationId);

  if (input.name && input.name !== category.name) {
    const existing = await LicenseCategory.findOne({ organization: organizationId, name: input.name });
    if (existing) throw new ApiError(409, "A license category with this name already exists");
  }

  Object.assign(category, input);
  await category.save();
  return category;
}

export async function deleteLicenseCategory(id: string, organizationId: string) {
  const category = await getLicenseCategoryById(id, organizationId);
  await category.deleteOne();
  return category;
}
