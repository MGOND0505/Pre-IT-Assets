import { LicenseCategory } from "../../models/LicenseCategory";
import { ApiError } from "../../utils/ApiError";

type ListInput = { page?: number; limit?: number; search?: string; status?: "Active" | "Inactive" };

export async function listLicenseCategories(input: ListInput) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = {};
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

export async function getLicenseCategoryById(id: string) {
  const category = await LicenseCategory.findById(id);
  if (!category) throw new ApiError(404, "License category not found");
  return category;
}

export async function createLicenseCategory(input: { name: string; description?: string }) {
  const existing = await LicenseCategory.findOne({ name: input.name });
  if (existing) throw new ApiError(409, "A license category with this name already exists");
  return LicenseCategory.create(input);
}

export async function updateLicenseCategory(
  id: string,
  input: Partial<{ name: string; description: string; status: "Active" | "Inactive" }>
) {
  const category = await getLicenseCategoryById(id);

  if (input.name && input.name !== category.name) {
    const existing = await LicenseCategory.findOne({ name: input.name });
    if (existing) throw new ApiError(409, "A license category with this name already exists");
  }

  Object.assign(category, input);
  await category.save();
  return category;
}

export async function deleteLicenseCategory(id: string) {
  const category = await getLicenseCategoryById(id);
  await category.deleteOne();
  return category;
}
