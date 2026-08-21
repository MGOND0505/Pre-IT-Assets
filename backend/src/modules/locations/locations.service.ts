import { Location } from "../../models/Location";
import { ApiError } from "../../utils/ApiError";

type ListInput = { page?: number; limit?: number; search?: string; status?: "Active" | "Inactive" };

export async function listLocations(input: ListInput) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = {};
  if (input.status) filter.status = input.status;
  if (input.search) filter.name = { $regex: input.search, $options: "i" };

  const [items, total] = await Promise.all([
    Location.find(filter)
      .sort({ name: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Location.countDocuments(filter),
  ]);

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getLocationById(id: string) {
  const location = await Location.findById(id);
  if (!location) throw new ApiError(404, "Location not found");
  return location;
}

export async function createLocation(input: {
  name: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
}) {
  const existing = await Location.findOne({ name: input.name });
  if (existing) throw new ApiError(409, "A location with this name already exists");
  return Location.create(input);
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
  }>
) {
  const location = await getLocationById(id);

  if (input.name && input.name !== location.name) {
    const existing = await Location.findOne({ name: input.name });
    if (existing) throw new ApiError(409, "A location with this name already exists");
  }

  Object.assign(location, input);
  await location.save();
  return location;
}

export async function deleteLocation(id: string) {
  const location = await getLocationById(id);
  await location.deleteOne();
  return location;
}
