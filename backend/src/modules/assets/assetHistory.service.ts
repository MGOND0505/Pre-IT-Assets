import { AssetHistory, type AssetHistoryAction } from "../../models/AssetHistory";

export async function recordAssetHistory(input: {
  asset: string;
  action: AssetHistoryAction;
  user: string | null;
  previousValue?: unknown;
  newValue?: unknown;
  remarks?: string;
}) {
  await AssetHistory.create({
    asset: input.asset,
    action: input.action,
    user: input.user,
    previousValue: input.previousValue ?? null,
    newValue: input.newValue ?? null,
    remarks: input.remarks ?? "",
  });
}

export async function listAssetHistory(assetId: string) {
  return AssetHistory.find({ asset: assetId }).populate("user", "name email").sort({ createdAt: -1 });
}
