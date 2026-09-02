import fs from "node:fs/promises";
import path from "node:path";
import { Types } from "mongoose";
import { Asset, type IAsset } from "../../models/Asset";
import { AssetCategory } from "../../models/AssetCategory";
import { AssetDocument } from "../../models/AssetDocument";
import { AssetHistory } from "../../models/AssetHistory";
import { User } from "../../models/User";
import { ApiError } from "../../utils/ApiError";
import { getSettings } from "../settings/settings.service";
import { ASSET_DOCUMENTS_DIR } from "../../utils/upload";
import { recordAssetHistory } from "./assetHistory.service";
import { getOrgRetentionDays, withRecycleBinMeta } from "../../utils/recycleBin";
import { escapeRegex } from "../../utils/regex";
import {
  notifyAssetCreated,
  notifyAssetUpdated,
  notifyAssetDeleted,
  notifyAssetsBulkDeleted,
} from "../../services/alerts/assetChangeAlerts";

const POPULATE_FIELDS = [
  { path: "category", select: "name prefix" },
  { path: "vendor", select: "name" },
  { path: "location", select: "name city" },
  { path: "department", select: "name" },
  { path: "assignedUser", select: "name email employeeId" },
];

type RequestingUser = { id: string; isAdmin: boolean; permissions: { assets: { update: boolean } } };

/** Same shape as helpdesk's canViewAllTickets / tasks' canViewAllTasks: one flag decides
 * org-wide visibility vs. only-what's-assigned-to-me. Assets has no "assign" action like
 * tasks/helpdesk do, so `update` (the closest existing "manages assets beyond their own" signal)
 * is the bypass here. */
function canViewAllAssets(user: RequestingUser): boolean {
  return user.isAdmin || user.permissions.assets.update;
}

/** Atomically claims the next sequence number for a category and formats the full asset ID. */
async function generateAssetId(categoryId: string, organizationId: string): Promise<string> {
  const category = await AssetCategory.findOneAndUpdate(
    { _id: categoryId, organization: organizationId },
    { $inc: { nextSequence: 1 } },
    { new: false }
  );

  if (!category) throw new ApiError(400, "Unknown asset category");

  const settings = await getSettings(organizationId);
  const sequence = String(category.nextSequence).padStart(6, "0");
  return `${settings.assetIdCompanyPrefix}-${category.prefix}-${sequence}`;
}

type ListInput = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  ownershipType?: string;
  criticality?: string;
  category?: string;
  location?: string;
  department?: string;
  vendor?: string;
  assignedUser?: string;
  /** "active" = warrantyEnd in the future, "expired" = warrantyEnd in the past, "expiringSoon" =
   * warrantyEnd within the next 30 days. Only assets with a warrantyEnd set ever match any of
   * these - an asset with no warranty data isn't silently counted as "expired". */
  warrantyStatus?: "active" | "expired" | "expiringSoon";
  purchaseDateFrom?: Date;
  purchaseDateTo?: Date;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  includeDeleted?: boolean;
};

export async function listAssets(input: ListInput, organizationId: string, requestingUser: RequestingUser) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = {
    organization: organizationId,
    isDeleted: input.includeDeleted ? true : false,
  };
  // A caller who can't manage assets beyond their own is hard-restricted to what's assigned to
  // them, regardless of the assignedUser query param - matches helpdesk/tasks' own list-visibility
  // pattern (canViewAllTickets/canViewAllTasks).
  if (!canViewAllAssets(requestingUser)) {
    filter.assignedUser = requestingUser.id;
  } else if (input.assignedUser) {
    filter.assignedUser = input.assignedUser;
  }
  if (input.status) filter.status = input.status;
  if (input.ownershipType) filter.ownershipType = input.ownershipType;
  if (input.criticality) filter.criticality = input.criticality;
  if (input.category) filter.category = input.category;
  if (input.location) filter.location = input.location;
  if (input.department) filter.department = input.department;
  if (input.vendor) filter.vendor = input.vendor;
  if (input.purchaseDateFrom || input.purchaseDateTo) {
    filter.purchaseDate = {
      ...(input.purchaseDateFrom ? { $gte: input.purchaseDateFrom } : {}),
      ...(input.purchaseDateTo ? { $lte: input.purchaseDateTo } : {}),
    };
  }
  if (input.warrantyStatus) {
    const now = new Date();
    if (input.warrantyStatus === "active") {
      filter.warrantyEnd = { $ne: null, $gte: now };
    } else if (input.warrantyStatus === "expired") {
      filter.warrantyEnd = { $ne: null, $lt: now };
    } else {
      filter.warrantyEnd = { $ne: null, $gte: now, $lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) };
    }
  }
  if (input.search) {
    const search = escapeRegex(input.search);
    const matchingUsers = await User.find({
      organization: organizationId,
      $or: [
        { name: { $regex: search, $options: "i" } },
        { employeeId: { $regex: search, $options: "i" } },
      ],
    }).select("_id");

    filter.$or = [
      { assetId: { $regex: search, $options: "i" } },
      { assetTag: { $regex: search, $options: "i" } },
      { name: { $regex: search, $options: "i" } },
      { serialNumber: { $regex: search, $options: "i" } },
      { serviceTag: { $regex: search, $options: "i" } },
      { imei: { $regex: search, $options: "i" } },
      { hostname: { $regex: search, $options: "i" } },
      { manufacturer: { $regex: search, $options: "i" } },
      { model: { $regex: search, $options: "i" } },
      { ipAddress: { $regex: search, $options: "i" } },
      { macAddress: { $regex: search, $options: "i" } },
      { employeeName: { $regex: search, $options: "i" } },
      { employeeId: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } },
      ...(matchingUsers.length > 0 ? [{ assignedUser: { $in: matchingUsers.map((u) => u.id) } }] : []),
    ];
  }

  const sortBy = input.sortBy ?? "createdDate";
  const sortDir = input.sortDir === "asc" ? 1 : -1;

  const [items, total] = await Promise.all([
    Asset.find(filter)
      .populate(POPULATE_FIELDS)
      .sort({ [sortBy]: sortDir })
      .skip((page - 1) * limit)
      .limit(limit),
    Asset.countDocuments(filter),
  ]);

  const retentionDays = await getOrgRetentionDays(organizationId);
  return { items: withRecycleBinMeta(items, retentionDays), total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getAssetById(id: string, organizationId: string) {
  const asset = await Asset.findOne({ _id: id, organization: organizationId }).populate(POPULATE_FIELDS);
  if (!asset) throw new ApiError(404, "Asset not found");
  return asset;
}

/** The view-facing variant of getAssetById - used by every read route that operates on a specific
 * asset id (detail, documents, history). A caller who can't see the whole fleet gets a 404 for an
 * asset that isn't assigned to them, same as `listAssets`' filter - never a 403, so an
 * unauthorized caller can't tell a real id from a made-up one. Internal write-flow lookups
 * (update/delete/restore) intentionally keep using the plain getAssetById above - their own
 * route-level permission (assets:update/delete) is the real authorization for those, not this
 * "am I allowed to look at this" check. */
export async function getAssetByIdForRequester(id: string, organizationId: string, requestingUser: RequestingUser) {
  const asset = await getAssetById(id, organizationId);
  if (!canViewAllAssets(requestingUser)) {
    const assignedUser = asset.assignedUser as unknown as { _id?: unknown } | null;
    const assignedUserId = assignedUser ? String(assignedUser._id ?? assignedUser) : null;
    if (assignedUserId !== requestingUser.id) throw new ApiError(404, "Asset not found");
  }
  return asset;
}

// assetId is optional input (manually assigned when the caller holds assets:editAssetId, per
// assets.controller.ts#stripAssetIdUnlessAuthorized) rather than never-accepted - falls back to
// generateAssetId() below when omitted, exactly as before.
type AssetInput = Partial<Omit<IAsset, "assetId">> & { assetId?: string };

async function assertAssetIdAvailable(assetId: string, organizationId: string, excludeId?: string) {
  const existing = await Asset.findOne({
    organization: organizationId,
    assetId,
    isDeleted: false,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (existing) throw new ApiError(409, "An asset with this ID already exists");
}

// Pre-checks mirroring assertAssetIdAvailable's pattern above - the DB's own partial unique index
// (Asset.ts) is the real, race-condition-safe guarantee, but a raw MongoServerError (E11000)
// reaching the global error handler unhandled would surface as a generic "Internal server error"
// (only ApiError instances get a clean message - see errorHandler.ts) rather than an actionable
// validation message. Blank values are never checked - both indexes are partial (unique only when
// non-blank), so a blank/blank collision is not actually a conflict.
async function assertAssetTagAvailable(assetTag: string, organizationId: string, excludeId?: string) {
  if (!assetTag) return;
  const existing = await Asset.findOne({
    organization: organizationId,
    assetTag,
    isDeleted: false,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (existing) throw new ApiError(409, "An asset with this asset tag already exists");
}

async function assertSerialNumberAvailable(serialNumber: string, organizationId: string, excludeId?: string) {
  if (!serialNumber) return;
  const existing = await Asset.findOne({
    organization: organizationId,
    serialNumber,
    isDeleted: false,
    ...(excludeId ? { _id: { $ne: excludeId } } : {}),
  });
  if (existing) throw new ApiError(409, "An asset with this serial number already exists");
}

export async function createAsset(
  input: AssetInput & { category: string },
  createdBy: string,
  organizationId: string,
  opts: { notify?: boolean } = {}
) {
  const category = await AssetCategory.findOne({ _id: input.category, organization: organizationId });
  if (!category) throw new ApiError(400, "Unknown asset category");

  let assetId: string;
  if (input.assetId) {
    await assertAssetIdAvailable(input.assetId, organizationId);
    assetId = input.assetId;
  } else {
    assetId = await generateAssetId(input.category, organizationId);
  }
  if (input.assetTag) await assertAssetTagAvailable(input.assetTag, organizationId);
  if (input.serialNumber) await assertSerialNumberAvailable(input.serialNumber, organizationId);

  const asset = await Asset.create({ ...input, assetId, organization: organizationId, createdBy });

  await recordAssetHistory({
    asset: asset.id,
    action: "Created",
    user: createdBy,
    newValue: { name: asset.name, status: asset.status },
    remarks: "Asset created",
  });

  if (opts.notify ?? true) notifyAssetCreated(organizationId, { assetId: asset.assetId, name: asset.name });

  return asset;
}

export async function updateAsset(
  id: string,
  input: AssetInput,
  organizationId: string,
  opts: { notify?: boolean } = {}
) {
  const asset = await getAssetById(id, organizationId);
  const before = asset.toObject();

  if (input.assetId && input.assetId !== asset.assetId) {
    await assertAssetIdAvailable(input.assetId, organizationId, id);
  }
  if (input.assetTag && input.assetTag !== asset.assetTag) {
    await assertAssetTagAvailable(input.assetTag, organizationId, id);
  }
  if (input.serialNumber && input.serialNumber !== asset.serialNumber) {
    await assertSerialNumberAvailable(input.serialNumber, organizationId, id);
  }

  // Merge, not replace - a request that doesn't mention a given custom field key (or one
  // belonging to a now-Inactive definition) must leave its previously-stored value untouched.
  // See customFieldValues.service.ts#validateCustomFieldValues.
  const customFields = input.customFields ? { ...asset.customFields, ...input.customFields } : undefined;
  Object.assign(asset, input);
  if (customFields) asset.customFields = customFields;
  await asset.save();
  if (opts.notify ?? true) {
    notifyAssetUpdated(
      organizationId,
      { assetId: asset.assetId, name: asset.name },
      before as unknown as Record<string, unknown>,
      asset.toObject() as unknown as Record<string, unknown>
    );
  }
  return asset;
}

/** Soft delete: the record is hidden from normal listings but recoverable by an Admin. */
export async function deleteAsset(id: string, deletedBy: string, organizationId: string) {
  const asset = await getAssetById(id, organizationId);
  asset.isDeleted = true;
  asset.deletedAt = new Date();
  asset.deletedBy = deletedBy as unknown as IAsset["deletedBy"];
  await asset.save();
  notifyAssetDeleted(organizationId, { assetId: asset.assetId, name: asset.name });
  return asset;
}

/** Soft delete: multiple assets at once, e.g. from the list page's multi-select. */
export async function bulkDeleteAssets(ids: string[], deletedBy: string, organizationId: string) {
  const result = await Asset.updateMany(
    { _id: { $in: ids }, organization: organizationId, isDeleted: false },
    { $set: { isDeleted: true, deletedAt: new Date(), deletedBy } }
  );
  notifyAssetsBulkDeleted(organizationId, result.modifiedCount);
  return result.modifiedCount;
}

export async function restoreAsset(id: string, organizationId: string) {
  const asset = await Asset.findOne({ _id: id, organization: organizationId });
  if (!asset) throw new ApiError(404, "Asset not found");
  asset.isDeleted = false;
  asset.deletedAt = null;
  asset.deletedBy = null;
  await asset.save();
  return asset;
}

const ACTIVE_FLEET_STATUSES = ["Available", "In Stock", "Assigned", "Reserved", "Under Repair", "Under Maintenance"];

export async function getAssetStats(organizationId: string) {
  const now = new Date();
  const warrantyExpiringBy = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  // .aggregate() pipelines, unlike find()/countDocuments(), never go through Mongoose's
  // automatic string->ObjectId query casting - a raw string here would silently match
  // nothing in every $match stage below (BSON type mismatch against the stored ObjectId),
  // while countDocuments() with the same shape works fine. Cast explicitly.
  const isDeletedFalse = { organization: new Types.ObjectId(organizationId), isDeleted: false };

  const [total, byStatus, byLocation, valueAgg, byCategory, byDepartment, topAssignees, warrantyExpiringSoon] =
    await Promise.all([
    Asset.countDocuments(isDeletedFalse),
    Asset.aggregate([{ $match: isDeletedFalse }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    Asset.aggregate([
      { $match: { ...isDeletedFalse, location: { $ne: null } } },
      { $group: { _id: "$location", count: { $sum: 1 } } },
      { $lookup: { from: "locations", localField: "_id", foreignField: "_id", as: "location" } },
      { $unwind: "$location" },
      { $project: { _id: 0, locationId: "$_id", name: "$location.name", count: 1 } },
    ]),
    Asset.aggregate([
      { $match: isDeletedFalse },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$purchaseCost", 0] } } } },
    ]),
    Asset.aggregate([
      { $match: { ...isDeletedFalse, category: { $ne: null } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $lookup: { from: "assetcategories", localField: "_id", foreignField: "_id", as: "category" } },
      { $unwind: "$category" },
      { $project: { _id: 0, categoryId: "$_id", name: "$category.name", count: 1 } },
      { $sort: { count: -1 } },
    ]),
    Asset.aggregate([
      { $match: { ...isDeletedFalse, department: { $ne: null } } },
      { $group: { _id: "$department", count: { $sum: 1 } } },
      { $lookup: { from: "departments", localField: "_id", foreignField: "_id", as: "department" } },
      { $unwind: "$department" },
      { $project: { _id: 0, departmentId: "$_id", name: "$department.name", count: 1 } },
      { $sort: { count: -1 } },
    ]),
    Asset.aggregate([
      { $match: { ...isDeletedFalse, assignedUser: { $ne: null } } },
      { $group: { _id: "$assignedUser", count: { $sum: 1 } } },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $project: { _id: 0, userId: "$_id", name: "$user.name", count: 1 } },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    Asset.countDocuments({ ...isDeletedFalse, warrantyEnd: { $ne: null, $gte: now, $lte: warrantyExpiringBy } }),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const row of byStatus) statusCounts[row._id] = row.count;

  const activeCount = ACTIVE_FLEET_STATUSES.reduce((sum, status) => sum + (statusCounts[status] ?? 0), 0);

  return {
    total,
    byStatus: statusCounts,
    byLocation,
    active: activeCount,
    totalValue: valueAgg[0]?.total ?? 0,
    byCategory,
    byDepartment,
    topAssignees,
    warrantyExpiringSoon,
  };
}

/** Unlike getAssetStats above (always org-wide), this is always scoped to exactly one user's own
 * assigned assets, regardless of their view-all permission - powers the Employee Portal's "My
 * Assets" widget. */
export async function getMyAssetSummary(organizationId: string, userId: string) {
  const filter = {
    organization: new Types.ObjectId(organizationId),
    isDeleted: false,
    assignedUser: new Types.ObjectId(userId),
  };

  const [total, byStatusRaw] = await Promise.all([
    Asset.countDocuments(filter),
    Asset.aggregate([{ $match: filter }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
  ]);

  const byStatus: Record<string, number> = {};
  for (const row of byStatusRaw) byStatus[row._id] = row.count;

  return { total, byStatus };
}

/** Permanently removes a soft-deleted asset and its uploaded documents. Admin-only, irreversible. */
export async function purgeAsset(id: string, organizationId: string) {
  const asset = await Asset.findOne({ _id: id, organization: organizationId });
  if (!asset) throw new ApiError(404, "Asset not found");
  if (!asset.isDeleted) throw new ApiError(400, "Only a soft-deleted asset can be permanently removed");

  const documents = await AssetDocument.find({ asset: id });
  await Promise.all(
    documents.map((doc) =>
      fs.unlink(path.join(ASSET_DOCUMENTS_DIR, doc.storedFileName)).catch(() => {
        /* file already gone - fine */
      })
    )
  );
  await AssetDocument.deleteMany({ asset: id });
  await AssetHistory.deleteMany({ asset: id });

  await asset.deleteOne();
  return asset;
}
