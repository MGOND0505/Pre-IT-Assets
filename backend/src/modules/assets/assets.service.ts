import fs from "node:fs/promises";
import path from "node:path";
import { Asset, type IAsset } from "../../models/Asset";
import { AssetCategory } from "../../models/AssetCategory";
import { AssetDocument } from "../../models/AssetDocument";
import { ApiError } from "../../utils/ApiError";
import { getSettings } from "../settings/settings.service";
import { ASSET_DOCUMENTS_DIR } from "../../utils/upload";
import { recordAssetHistory } from "./assetHistory.service";

const POPULATE_FIELDS = [
  { path: "category", select: "name prefix" },
  { path: "vendor", select: "name" },
  { path: "location", select: "name city" },
  { path: "department", select: "name" },
  { path: "assignedUser", select: "name email" },
];

/** Atomically claims the next sequence number for a category and formats the full asset ID. */
async function generateAssetId(categoryId: string): Promise<string> {
  const category = await AssetCategory.findOneAndUpdate(
    { _id: categoryId },
    { $inc: { nextSequence: 1 } },
    { new: false }
  );

  if (!category) throw new ApiError(400, "Unknown asset category");

  const settings = await getSettings();
  const sequence = String(category.nextSequence).padStart(6, "0");
  return `${settings.assetIdCompanyPrefix}-${category.prefix}-${sequence}`;
}

type ListInput = {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  category?: string;
  location?: string;
  department?: string;
  vendor?: string;
  purchaseDateFrom?: Date;
  purchaseDateTo?: Date;
  sortBy?: string;
  sortDir?: "asc" | "desc";
};

export async function listAssets(input: ListInput) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = {};
  if (input.status) filter.status = input.status;
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
  if (input.search) {
    filter.$or = [
      { assetId: { $regex: input.search, $options: "i" } },
      { name: { $regex: input.search, $options: "i" } },
      { serialNumber: { $regex: input.search, $options: "i" } },
      { serviceTag: { $regex: input.search, $options: "i" } },
      { hostname: { $regex: input.search, $options: "i" } },
      { manufacturer: { $regex: input.search, $options: "i" } },
      { model: { $regex: input.search, $options: "i" } },
      { ipAddress: { $regex: input.search, $options: "i" } },
      { macAddress: { $regex: input.search, $options: "i" } },
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

  return { items, total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getAssetById(id: string) {
  const asset = await Asset.findById(id).populate(POPULATE_FIELDS);
  if (!asset) throw new ApiError(404, "Asset not found");
  return asset;
}

type AssetInput = Partial<Omit<IAsset, "assetId">>;

export async function createAsset(input: AssetInput & { category: string }, createdBy: string) {
  const category = await AssetCategory.findById(input.category);
  if (!category) throw new ApiError(400, "Unknown asset category");

  const assetId = await generateAssetId(input.category);

  const asset = await Asset.create({ ...input, assetId, createdBy });

  await recordAssetHistory({
    asset: asset.id,
    action: "Created",
    user: createdBy,
    newValue: { name: asset.name, status: asset.status },
    remarks: "Asset created",
  });

  return asset;
}

export async function updateAsset(id: string, input: AssetInput) {
  const asset = await getAssetById(id);
  Object.assign(asset, input);
  await asset.save();
  return asset;
}

export async function deleteAsset(id: string) {
  const asset = await getAssetById(id);

  const documents = await AssetDocument.find({ asset: id });
  await Promise.all(
    documents.map((doc) =>
      fs.unlink(path.join(ASSET_DOCUMENTS_DIR, doc.storedFileName)).catch(() => {
        /* file already gone - fine */
      })
    )
  );
  await AssetDocument.deleteMany({ asset: id });

  await asset.deleteOne();
  return asset;
}
