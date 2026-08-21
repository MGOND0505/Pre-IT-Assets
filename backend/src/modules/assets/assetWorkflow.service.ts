import { Asset } from "../../models/Asset";
import { AssetAssignment } from "../../models/AssetAssignment";
import { AssetTransfer } from "../../models/AssetTransfer";
import { ApiError } from "../../utils/ApiError";
import { recordAssetHistory } from "./assetHistory.service";

async function getAssetOrThrow(id: string) {
  const asset = await Asset.findById(id);
  if (!asset) throw new ApiError(404, "Asset not found");
  return asset;
}

export async function assignAsset(
  assetId: string,
  input: { assignedTo?: string; department?: string; location?: string; remarks?: string },
  actingUserId: string
) {
  const asset = await getAssetOrThrow(assetId);

  const activeAssignment = await AssetAssignment.findOne({ asset: assetId, returnedDate: null });
  const isReassignment = Boolean(activeAssignment);

  if (activeAssignment) {
    activeAssignment.returnedDate = new Date();
    activeAssignment.returnRemarks = "Reassigned";
    await activeAssignment.save();
  }

  const previousValue = {
    assignedUser: asset.assignedUser,
    department: asset.department,
    location: asset.location,
  };

  asset.assignedUser = (input.assignedTo as never) ?? asset.assignedUser;
  asset.department = (input.department as never) ?? asset.department;
  asset.location = (input.location as never) ?? asset.location;
  if (input.assignedTo) asset.status = "Assigned";
  await asset.save();

  await AssetAssignment.create({
    asset: assetId,
    assignedTo: input.assignedTo ?? null,
    department: input.department ?? null,
    location: input.location ?? null,
    assignedBy: actingUserId,
    remarks: input.remarks ?? "",
  });

  await recordAssetHistory({
    asset: assetId,
    action: isReassignment ? "Reassigned" : "Assigned",
    user: actingUserId,
    previousValue,
    newValue: { assignedUser: asset.assignedUser, department: asset.department, location: asset.location },
    remarks: input.remarks ?? "",
  });

  return asset;
}

export async function transferAsset(
  assetId: string,
  input: {
    toUser?: string;
    toLocation?: string;
    toDepartment?: string;
    reason?: string;
    approvedBy?: string;
    remarks?: string;
  },
  actingUserId: string
) {
  const asset = await getAssetOrThrow(assetId);

  const fromUser = asset.assignedUser;
  const fromLocation = asset.location;
  const fromDepartment = asset.department;

  asset.assignedUser = (input.toUser as never) ?? asset.assignedUser;
  asset.location = (input.toLocation as never) ?? asset.location;
  asset.department = (input.toDepartment as never) ?? asset.department;
  await asset.save();

  const activeAssignment = await AssetAssignment.findOne({ asset: assetId, returnedDate: null });
  if (activeAssignment) {
    if (input.toUser) activeAssignment.assignedTo = input.toUser as never;
    if (input.toLocation) activeAssignment.location = input.toLocation as never;
    if (input.toDepartment) activeAssignment.department = input.toDepartment as never;
    await activeAssignment.save();
  }

  await AssetTransfer.create({
    asset: assetId,
    fromUser,
    toUser: input.toUser ?? fromUser,
    fromLocation,
    toLocation: input.toLocation ?? fromLocation,
    fromDepartment,
    toDepartment: input.toDepartment ?? fromDepartment,
    reason: input.reason ?? "",
    approvedBy: input.approvedBy ?? null,
    remarks: input.remarks ?? "",
    performedBy: actingUserId,
  });

  await recordAssetHistory({
    asset: assetId,
    action: "Transferred",
    user: actingUserId,
    previousValue: { fromUser, fromLocation, fromDepartment },
    newValue: { toUser: asset.assignedUser, toLocation: asset.location, toDepartment: asset.department },
    remarks: input.reason ?? "",
  });

  return asset;
}

export async function returnAsset(assetId: string, input: { remarks?: string }, actingUserId: string) {
  const asset = await getAssetOrThrow(assetId);

  const previousValue = { assignedUser: asset.assignedUser, status: asset.status };

  const activeAssignment = await AssetAssignment.findOne({ asset: assetId, returnedDate: null });
  if (activeAssignment) {
    activeAssignment.returnedDate = new Date();
    activeAssignment.returnRemarks = input.remarks ?? "";
    await activeAssignment.save();
  }

  asset.assignedUser = null;
  asset.status = "Available";
  await asset.save();

  await recordAssetHistory({
    asset: assetId,
    action: "Returned",
    user: actingUserId,
    previousValue,
    newValue: { assignedUser: null, status: asset.status },
    remarks: input.remarks ?? "",
  });

  return asset;
}

export async function retireAsset(
  assetId: string,
  input: { reason?: string; remarks?: string },
  actingUserId: string
) {
  const asset = await getAssetOrThrow(assetId);

  const previousValue = { assignedUser: asset.assignedUser, status: asset.status };

  const activeAssignment = await AssetAssignment.findOne({ asset: assetId, returnedDate: null });
  if (activeAssignment) {
    activeAssignment.returnedDate = new Date();
    activeAssignment.returnRemarks = "Retired";
    await activeAssignment.save();
  }

  asset.assignedUser = null;
  asset.status = "Retired";
  await asset.save();

  await recordAssetHistory({
    asset: assetId,
    action: "Retired",
    user: actingUserId,
    previousValue,
    newValue: { status: asset.status },
    remarks: input.reason ?? input.remarks ?? "",
  });

  return asset;
}
