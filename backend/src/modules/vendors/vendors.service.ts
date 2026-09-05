import { Vendor, type IVendor } from "../../models/Vendor";
import { ApiError } from "../../utils/ApiError";
import { getOrgRetentionDays, withRecycleBinMeta } from "../../utils/recycleBin";
import { tokenSearchFilter, fuzzyFallback } from "../../utils/smartSearch";

const VENDOR_SEARCH_FIELDS = ["name", "contactPerson", "email"];

type ListInput = { page?: number; limit?: number; search?: string; status?: "Active" | "Inactive"; includeDeleted?: boolean };

export async function listVendors(input: ListInput, organizationId: string) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = { organization: organizationId, isDeleted: input.includeDeleted ? true : false };
  if (input.status) filter.status = input.status;
  let baseFilterWithoutSearch: Record<string, unknown> | undefined;
  if (input.search) {
    baseFilterWithoutSearch = { ...filter };
    filter.$or = [tokenSearchFilter(VENDOR_SEARCH_FIELDS, input.search)];
  }

  const [items, total] = await Promise.all([
    Vendor.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Vendor.countDocuments(filter),
  ]);

  const retentionDays = await getOrgRetentionDays(organizationId);

  if (total === 0 && input.search && baseFilterWithoutSearch) {
    const fallbackDocs = await fuzzyFallback<InstanceType<typeof Vendor>>(Vendor, baseFilterWithoutSearch, VENDOR_SEARCH_FIELDS, input.search);
    if (fallbackDocs.length > 0) {
      return { items: withRecycleBinMeta(fallbackDocs, retentionDays), total: fallbackDocs.length, page: 1, limit, totalPages: 1 };
    }
  }

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
  customFields: Record<string, unknown>;
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

  // Merge, not replace - a request that doesn't mention a given custom field key (or one
  // belonging to a now-Inactive definition) must leave its previously-stored value untouched.
  // See customFieldValues.service.ts#validateCustomFieldValues and assets.service.ts#updateAsset.
  const customFields = input.customFields ? { ...vendor.customFields, ...input.customFields } : undefined;
  Object.assign(vendor, input);
  if (customFields) vendor.customFields = customFields;
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
