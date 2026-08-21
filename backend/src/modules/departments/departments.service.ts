import { Department } from "../../models/Department";
import { ApiError } from "../../utils/ApiError";

type ListInput = { page?: number; limit?: number; search?: string; status?: "Active" | "Inactive" };

export async function listDepartments(input: ListInput) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = {};
  if (input.status) filter.status = input.status;
  if (input.search) filter.name = { $regex: input.search, $options: "i" };

  const [items, total] = await Promise.all([
    Department.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Department.countDocuments(filter),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getDepartmentById(id: string) {
  const department = await Department.findById(id);
  if (!department) throw new ApiError(404, "Department not found");
  return department;
}

export async function createDepartment(input: { name: string; description?: string }) {
  const existing = await Department.findOne({ name: input.name });
  if (existing) throw new ApiError(409, "A department with this name already exists");
  return Department.create(input);
}

export async function updateDepartment(
  id: string,
  input: Partial<{ name: string; description: string; status: "Active" | "Inactive" }>
) {
  const department = await getDepartmentById(id);

  if (input.name && input.name !== department.name) {
    const existing = await Department.findOne({ name: input.name });
    if (existing) throw new ApiError(409, "A department with this name already exists");
  }

  Object.assign(department, input);
  await department.save();
  return department;
}

export async function deleteDepartment(id: string) {
  const department = await getDepartmentById(id);
  await department.deleteOne();
  return department;
}
