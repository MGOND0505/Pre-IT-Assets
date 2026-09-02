import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import { validateCustomFieldValues } from "../customFieldDefinitions/customFieldValues.service";
import * as assetsService from "./assets.service";

type ListAssetsQuery = Parameters<typeof assetsService.listAssets>[0];

function requestingUserFrom(req: Request) {
  return { id: req.user!.id, isAdmin: req.user!.isAdmin, permissions: req.user!.permissions };
}

export const listAssets = asyncHandler(async (req: Request, res: Response) => {
  const result = await assetsService.listAssets(req.query as never, req.organization!._id, requestingUserFrom(req));
  ok(res, result, "Assets");
});

export const getAssetStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await assetsService.getAssetStats(req.organization!._id);
  ok(res, stats, "Asset stats");
});

export const getMyAssetSummary = asyncHandler(async (req: Request, res: Response) => {
  const summary = await assetsService.getMyAssetSummary(req.organization!._id, req.user!.id);
  ok(res, summary, "My asset summary");
});

export const listDeletedAssets = asyncHandler(async (req: Request, res: Response) => {
  const result = await assetsService.listAssets(
    { ...(req.query as unknown as ListAssetsQuery), includeDeleted: true },
    req.organization!._id,
    requestingUserFrom(req)
  );
  ok(res, result, "Deleted assets");
});

export const getAsset = asyncHandler(async (req: Request, res: Response) => {
  const asset = await assetsService.getAssetByIdForRequester(req.params.id, req.organization!._id, requestingUserFrom(req));
  ok(res, asset, "Asset");
});

/** The request body's assetId is only ever honored when the caller actually holds
 * assets:editAssetId - stripped here regardless of what the frontend does or doesn't show, so a
 * direct API call from an unauthorized user can never set one. Falls back to auto-generation. */
function stripAssetIdUnlessAuthorized(req: Request): void {
  const canEditAssetId = req.user!.isAdmin || req.user!.permissions.assets.editAssetId;
  if (!canEditAssetId) delete req.body.assetId;
}

export const createAsset = asyncHandler(async (req: Request, res: Response) => {
  stripAssetIdUnlessAuthorized(req);
  req.body.customFields = await validateCustomFieldValues(
    req.body.customFields,
    "assets",
    req.organization!._id,
    req.body.category
  );
  const asset = await assetsService.createAsset(req.body, req.user!.id, req.organization!._id);

  await logAction({
    req,
    action: "CREATE",
    module: "Asset",
    recordId: asset.id,
    recordLabel: asset.assetId,
    newValue: { name: asset.name, category: asset.category, status: asset.status },
  });

  ok(res, asset, "Asset created", 201);
});

export const updateAsset = asyncHandler(async (req: Request, res: Response) => {
  stripAssetIdUnlessAuthorized(req);
  const before = await assetsService.getAssetById(req.params.id, req.organization!._id);
  const oldValue = before.toObject();

  req.body.customFields = await validateCustomFieldValues(
    req.body.customFields,
    "assets",
    req.organization!._id,
    req.body.category ?? String(before.category)
  );
  const asset = await assetsService.updateAsset(req.params.id, req.body, req.organization!._id, req.user!.id);

  await logAction({
    req,
    action: "UPDATE",
    module: "Asset",
    recordId: asset.id,
    recordLabel: asset.assetId,
    oldValue,
    newValue: req.body,
  });

  ok(res, asset, "Asset updated");
});

export const deleteAsset = asyncHandler(async (req: Request, res: Response) => {
  const asset = await assetsService.deleteAsset(req.params.id, req.user!.id, req.organization!._id);

  await logAction({
    req,
    action: "DELETE",
    module: "Asset",
    recordId: req.params.id,
    recordLabel: asset.assetId,
  });

  ok(res, null, "Asset deleted");
});

export const bulkDeleteAssets = asyncHandler(async (req: Request, res: Response) => {
  const ids = Array.isArray(req.body.ids) ? (req.body.ids as string[]) : [];
  const deleted = await assetsService.bulkDeleteAssets(ids, req.user!.id, req.organization!._id);

  await logAction({
    req,
    action: "BULK_DELETE",
    module: "Asset",
    recordLabel: `${deleted} asset(s) deleted`,
    newValue: { requested: ids.length, deleted },
  });

  ok(res, { deleted }, "Assets deleted");
});

export const restoreAsset = asyncHandler(async (req: Request, res: Response) => {
  const asset = await assetsService.restoreAsset(req.params.id, req.organization!._id);

  await logAction({ req, action: "RESTORE", module: "Asset", recordId: asset.id, recordLabel: asset.assetId });

  ok(res, asset, "Asset restored");
});

export const purgeAsset = asyncHandler(async (req: Request, res: Response) => {
  const asset = await assetsService.purgeAsset(req.params.id, req.organization!._id);

  await logAction({ req, action: "PURGE", module: "Asset", recordId: req.params.id, recordLabel: asset.assetId });

  ok(res, null, "Asset permanently removed");
});
