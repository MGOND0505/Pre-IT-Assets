import { Vendor } from "../../models/Vendor";
import { ApiError } from "../../utils/ApiError";

type ListInput = { page?: number; limit?: number; search?: string; status?: "Active" | "Inactive" };

export async function listVendors(input: ListInput) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = {};
  if (input.status) filter.status = input.status;
  if (input.search) {
    filter.$or = [
      { name: { $regex: input.search, $options: "i" } },
      { contactPerson: { $regex: input.search, $options: "i" } },
      { email: { $regex: input.search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    Vendor.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Vendor.countDocuments(filter),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getVendorById(id: string) {
  const vendor = await Vendor.findById(id);
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

export async function createVendor(input: VendorInput & { name: string }) {
  const existing = await Vendor.findOne({ name: input.name });
  if (existing) throw new ApiError(409, "A vendor with this name already exists");
  return Vendor.create(input);
}

export async function updateVendor(id: string, input: VendorInput) {
  const vendor = await getVendorById(id);

  if (input.name && input.name !== vendor.name) {
    const existing = await Vendor.findOne({ name: input.name });
    if (existing) throw new ApiError(409, "A vendor with this name already exists");
  }

  Object.assign(vendor, input);
  await vendor.save();
  return vendor;
}

export async function deleteVendor(id: string) {
  const vendor = await getVendorById(id);
  await vendor.deleteOne();
  return vendor;
}
