import { Vendor, type IVendor } from "../../models/Vendor";
import { ApiError } from "../../utils/ApiError";
import { getOrgRetentionDays, withRecycleBinMeta } from "../../utils/recycleBin";
import { escapeRegex } from "../../utils/regex";

type ListInput = { page?: number; limit?: number; search?: string; status?: "Active" | "Inactive"; includeDeleted?: boolean };

export async function listVendors(input: ListInput, organizationId: string) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = { organization: organizationId, isDeleted: input.includeDeleted ? true : false };
  if (input.status) filter.status = input.status;
  if (input.search) {
    const search = escapeRegex(input.search);
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { contactPerson: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    Vendor.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Vendor.countDocuments(filter),
  ]);

  const retentionDays = await getOrgRetentionDays(organizationId);
  return { items: withRecycleBinMeta(items, retentionDays), total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getVendorById(id: string, organizationId: string) {
  const vendor = await Vendor.findOne({ organization: organizationId, _id: id, isDeleted: false });
  if (!vendor) throw new ApiError(404, "Vendor not found");
  return vendor;
}

type VendorInput = Partial<{
  name: string;
  contactPerson: string;
  email: string;
  phone: string;
  service: string;
  address: string;
  contractStart: Date;
  contractEnd: Date;
  status: "Active" | "Inactive";
  notes: string;
}>;

async function assertNameAvailable(organizationId: string, name?: string, excludeId?: string) {
  if (!name) return;
  const existing = await Vendor.findOne({ organization: organizationId, name, isDeleted: false, _id: { $ne: excludeId } });
  if (existing) throw new ApiError(409, "A vendor with this name already exists");
}

export async function createVendor(input: VendorInput & { name: string }, organizationId: string) {
  await assertNameAvailable(organizationId, input.name);
  return Vendor.create({ organization: organizationId, ...input });
}

export async function updateVendor(id: string, input: VendorInput, organizationId: string) {
  const vendor = await getVendorById(id, organizationId);
  await assertNameAvailable(organizationId, input.name, id);

  Object.assign(vendor, input);
  await vendor.save();
  return vendor;
}

/** Soft delete: hidden from normal listings but recoverable via the Recycle Bin. */
export async function deleteVendor(id: string, deletedBy: string, organizationId: string) {
  const vendor = await getVendorById(id, organizationId);
  vendor.isDeleted = true;
  vendor.deletedAt = new Date();
  vendor.deletedBy = deletedBy as unknown as IVendor["deletedBy"];
  await vendor.save();
  return vendor;
}

export async function restoreVendor(id: string, organizationId: string) {
  const vendor = await Vendor.findOne({ organization: organizationId, _id: id, isDeleted: true });
  if (!vendor) throw new ApiError(404, "Deleted vendor not found");
  await assertNameAvailable(organizationId, vendor.name, id);

  vendor.isDeleted = false;
  vendor.deletedAt = null;
  vendor.deletedBy = null;
  await vendor.save();
  return vendor;
}
