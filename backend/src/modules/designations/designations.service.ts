import { Designation, type IDesignation } from "../../models/Designation";
import { ApiError } from "../../utils/ApiError";
import { getOrgRetentionDays, withRecycleBinMeta } from "../../utils/recycleBin";
import { tokenSearchFilter } from "../../utils/smartSearch";

type ListInput = { page?: number; limit?: number; search?: string; status?: "Active" | "Inactive"; includeDeleted?: boolean };

export async function listDesignations(input: ListInput, organizationId: string) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = { organization: organizationId, isDeleted: input.includeDeleted ? true : false };
  if (input.status) filter.status = input.status;
  if (input.search) Object.assign(filter, tokenSearchFilter(["name"], input.search));

  const [items, total] = await Promise.all([
    Designation.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Designation.countDocuments(filter),
  ]);

  const retentionDays = await getOrgRetentionDays(organizationId);
  return { items: withRecycleBinMeta(items, retentionDays), total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getDesignationById(id: string, organizationId: string) {
  const designation = await Designation.findOne({ organization: organizationId, _id: id, isDeleted: false });
  if (!designation) throw new ApiError(404, "Designation not found");
  return designation;
}

async function assertNameAvailable(organizationId: string, name?: string, excludeId?: string) {
  if (!name) return;
  const existing = await Designation.findOne({ organization: organizationId, name, isDeleted: false, _id: { $ne: excludeId } });
  if (existing) throw new ApiError(409, "A designation with this name already exists");
}

export async function createDesignation(input: { name: string; description?: string }, organizationId: string) {
  await assertNameAvailable(organizationId, input.name);
  return Designation.create({ organization: organizationId, ...input });
}

export async function updateDesignation(
  id: string,
  input: Partial<{ name: string; description: string; status: "Active" | "Inactive" }>,
  organizationId: string
) {
  const designation = await getDesignationById(id, organizationId);
  await assertNameAvailable(organizationId, input.name, id);

  Object.assign(designation, input);
  await designation.save();
  return designation;
}

/** Soft delete: hidden from normal listings but recoverable via the Recycle Bin. */
export async function deleteDesignation(id: string, deletedBy: string, organizationId: string) {
  const designation = await getDesignationById(id, organizationId);
  designation.isDeleted = true;
  designation.deletedAt = new Date();
  designation.deletedBy = deletedBy as unknown as IDesignation["deletedBy"];
  await designation.save();
  return designation;
}

export async function restoreDesignation(id: string, organizationId: string) {
  const designation = await Designation.findOne({ organization: organizationId, _id: id, isDeleted: true });
  if (!designation) throw new ApiError(404, "Deleted designation not found");
  await assertNameAvailable(organizationId, designation.name, id);

  designation.isDeleted = false;
  designation.deletedAt = null;
  designation.deletedBy = null;
  await designation.save();
  return designation;
}
