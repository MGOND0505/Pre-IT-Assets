import { License, type ILicense } from "../../models/License";
import { ApiError } from "../../utils/ApiError";
import { claimNextLicenseSequence } from "../settings/settings.service";
import { getOrgRetentionDays, withRecycleBinMeta } from "../../utils/recycleBin";
import { escapeRegex } from "../../utils/regex";

const POPULATE_FIELDS = [
  { path: "category", select: "name" },
  { path: "vendor", select: "name" },
  { path: "department", select: "name" },
  { path: "assignedUsers", select: "name email employeeId" },
];

async function generateLicenseId(organizationId: string): Promise<string> {
  const { prefix, sequence } = await claimNextLicenseSequence(organizationId);
  return `${prefix}-${String(sequence).padStart(6, "0")}`;
}

type ListInput = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  category?: string;
  vendor?: string;
  includeDeleted?: boolean;
};

export async function listLicenses(organizationId: string, input: ListInput) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = {
    organization: organizationId,
    isDeleted: input.includeDeleted ? true : false,
  };
  if (input.status) filter.status = input.status;
  if (input.category) filter.category = input.category;
  if (input.vendor) filter.vendor = input.vendor;
  if (input.search) {
    const search = escapeRegex(input.search);
    filter.$or = [
      { licenseId: { $regex: search, $options: "i" } },
      { softwareName: { $regex: search, $options: "i" } },
      { productName: { $regex: search, $options: "i" } },
      { publisher: { $regex: search, $options: "i" } },
    ];
  }

  const [items, total] = await Promise.all([
    License.find(filter)
      .populate(POPULATE_FIELDS)
      .sort({ createdDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    License.countDocuments(filter),
  ]);

  const retentionDays = await getOrgRetentionDays(organizationId);
  return { items: withRecycleBinMeta(items, retentionDays), total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getLicenseById(organizationId: string, id: string) {
  const license = await License.findOne({ _id: id, organization: organizationId }).populate(POPULATE_FIELDS);
  if (!license) throw new ApiError(404, "License not found");
  return license;
}

type LicenseInput = Partial<Omit<ILicense, "licenseId" | "organization">>;

export async function createLicense(organizationId: string, input: LicenseInput, createdBy: string) {
  // The sequence counter is claimed atomically, but retry on a duplicate-key race
  // (e.g. two concurrent creates, or a counter that drifted behind existing data)
  // rather than surfacing a raw 500 to the caller.
  for (let attempt = 0; attempt < 3; attempt++) {
    const licenseId = await generateLicenseId(organizationId);
    try {
      return await License.create({ ...input, organization: organizationId, licenseId, createdBy });
    } catch (err) {
      const isDuplicateKey = (err as { code?: number })?.code === 11000;
      if (!isDuplicateKey || attempt === 2) throw err;
    }
  }
  throw new ApiError(500, "Could not generate a unique license ID, please try again");
}

export async function updateLicense(organizationId: string, id: string, input: LicenseInput) {
  const license = await getLicenseById(organizationId, id);

  if (input.assignedUsers && input.assignedUsers.length > license.totalLicenses) {
    throw new ApiError(409, "Cannot assign more users than the total license seats");
  }

  Object.assign(license, input);
  await license.save();
  return license;
}

/** Soft delete: the record is hidden from normal listings but recoverable by an Admin. */
export async function deleteLicense(organizationId: string, id: string, deletedBy: string) {
  const license = await getLicenseById(organizationId, id);
  license.isDeleted = true;
  license.deletedAt = new Date();
  license.deletedBy = deletedBy as unknown as ILicense["deletedBy"];
  await license.save();
  return license;
}

export async function getLicenseStats(organizationId: string) {
  const now = new Date();
  const expiringBy = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const base = { organization: organizationId, isDeleted: false };

  const [total, active, expiringSoon, expired] = await Promise.all([
    License.countDocuments(base),
    License.countDocuments({ ...base, status: "Active" }),
    License.countDocuments({
      ...base,
      status: "Active",
      expiryDate: { $ne: null, $gte: now, $lte: expiringBy },
    }),
    License.countDocuments({ ...base, status: "Expired" }),
  ]);

  return { total, active, expiringSoon, expired };
}

export async function restoreLicense(organizationId: string, id: string) {
  const license = await License.findOne({ _id: id, organization: organizationId });
  if (!license) throw new ApiError(404, "License not found");
  license.isDeleted = false;
  license.deletedAt = null;
  license.deletedBy = null;
  await license.save();
  return license;
}
