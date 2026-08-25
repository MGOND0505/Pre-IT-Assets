import { Location, type ILocation } from "../../models/Location";
import { ApiError } from "../../utils/ApiError";
import { getOrgRetentionDays, withRecycleBinMeta } from "../../utils/recycleBin";

type ListInput = { page?: number; limit?: number; search?: string; status?: "Active" | "Inactive"; includeDeleted?: boolean };

export async function listLocations(input: ListInput, organizationId: string) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = { organization: organizationId, isDeleted: input.includeDeleted ? true : false };
  if (input.status) filter.status = input.status;
  if (input.search) filter.name = { $regex: input.search, $options: "i" };

  const [items, total] = await Promise.all([
    Location.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Location.countDocuments(filter),
  ]);

  const retentionDays = await getOrgRetentionDays(organizationId);
  return { items: withRecycleBinMeta(items, retentionDays), total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getLocationById(id: string, organizationId: string) {
  const location = await Location.findOne({ organization: organizationId, _id: id, isDeleted: false });
  if (!location) throw new ApiError(404, "Location not found");
  return location;
}

async function assertNameAvailable(organizationId: string, name?: string, excludeId?: string) {
  if (!name) return;
  const existing = await Location.findOne({ organization: organizationId, name, isDeleted: false, _id: { $ne: excludeId } });
  if (existing) throw new ApiError(409, "A location with this name already exists");
}

export async function createLocation(
  input: { name: string; address?: string; city?: string; state?: string; country?: string },
  organizationId: string
) {
  await assertNameAvailable(organizationId, input.name);
  return Location.create({ organization: organizationId, ...input });
}

export async function updateLocation(
  id: string,
  input: Partial<{
    name: string;
    address: string;
    city: string;
    state: string;
    country: string;
    status: "Active" | "Inactive";
  }>,
  organizationId: string
) {
  const location = await getLocationById(id, organizationId);
  await assertNameAvailable(organizationId, input.name, id);

  Object.assign(location, input);
  await location.save();
  return location;
}

/** Soft delete: hidden from normal listings but recoverable via the Recycle Bin. */
export async function deleteLocation(id: string, deletedBy: string, organizationId: string) {
  const location = await getLocationById(id, organizationId);
  location.isDeleted = true;
  location.deletedAt = new Date();
  location.deletedBy = deletedBy as unknown as ILocation["deletedBy"];
  await location.save();
  return location;
}

export async function restoreLocation(id: string, organizationId: string) {
  const location = await Location.findOne({ organization: organizationId, _id: id, isDeleted: true });
  if (!location) throw new ApiError(404, "Deleted location not found");
  await assertNameAvailable(organizationId, location.name, id);

  location.isDeleted = false;
  location.deletedAt = null;
  location.deletedBy = null;
  await location.save();
  return location;
}
