import { Department, type IDepartment } from "../../models/Department";
import { ApiError } from "../../utils/ApiError";
import { getOrgRetentionDays, withRecycleBinMeta } from "../../utils/recycleBin";
import { escapeRegex } from "../../utils/regex";

type ListInput = { page?: number; limit?: number; search?: string; status?: "Active" | "Inactive"; includeDeleted?: boolean };

export async function listDepartments(input: ListInput, organizationId: string) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = { organization: organizationId, isDeleted: input.includeDeleted ? true : false };
  if (input.status) filter.status = input.status;
  if (input.search) filter.name = { $regex: escapeRegex(input.search), $options: "i" };

  const [items, total] = await Promise.all([
    Department.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Department.countDocuments(filter),
  ]);

  const retentionDays = await getOrgRetentionDays(organizationId);
  return { items: withRecycleBinMeta(items, retentionDays), total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getDepartmentById(id: string, organizationId: string) {
  const department = await Department.findOne({ organization: organizationId, _id: id, isDeleted: false });
  if (!department) throw new ApiError(404, "Department not found");
  return department;
}

async function assertNameAvailable(organizationId: string, name?: string, excludeId?: string) {
  if (!name) return;
  const existing = await Department.findOne({ organization: organizationId, name, isDeleted: false, _id: { $ne: excludeId } });
  if (existing) throw new ApiError(409, "A department with this name already exists");
}

export async function createDepartment(input: { name: string; description?: string }, organizationId: string) {
  await assertNameAvailable(organizationId, input.name);
  return Department.create({ organization: organizationId, ...input });
}

export async function updateDepartment(
  id: string,
  input: Partial<{ name: string; description: string; status: "Active" | "Inactive" }>,
  organizationId: string
) {
  const department = await getDepartmentById(id, organizationId);
  await assertNameAvailable(organizationId, input.name, id);

  Object.assign(department, input);
  await department.save();
  return department;
}

/** Soft delete: hidden from normal listings but recoverable via the Recycle Bin. */
export async function deleteDepartment(id: string, deletedBy: string, organizationId: string) {
  const department = await getDepartmentById(id, organizationId);
  department.isDeleted = true;
  department.deletedAt = new Date();
  department.deletedBy = deletedBy as unknown as IDepartment["deletedBy"];
  await department.save();
  return department;
}

export async function restoreDepartment(id: string, organizationId: string) {
  const department = await Department.findOne({ organization: organizationId, _id: id, isDeleted: true });
  if (!department) throw new ApiError(404, "Deleted department not found");
  await assertNameAvailable(organizationId, department.name, id);

  department.isDeleted = false;
  department.deletedAt = null;
  department.deletedBy = null;
  await department.save();
  return department;
}
