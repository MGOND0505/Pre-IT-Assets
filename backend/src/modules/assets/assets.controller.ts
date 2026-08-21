import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as assetsService from "./assets.service";

export const listAssets = asyncHandler(async (req: Request, res: Response) => {
  const result = await assetsService.listAssets(req.query as never);
  ok(res, result, "Assets");
});

export const getAsset = asyncHandler(async (req: Request, res: Response) => {
  const asset = await assetsService.getAssetById(req.params.id);
  ok(res, asset, "Asset");
});

export const createAsset = asyncHandler(async (req: Request, res: Response) => {
  const asset = await assetsService.createAsset(req.body, req.user!.id);

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
  const before = await assetsService.getAssetById(req.params.id);
  const oldValue = before.toObject();

  const asset = await assetsService.updateAsset(req.params.id, req.body);

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
  const asset = await assetsService.deleteAsset(req.params.id);

  await logAction({
    req,
    action: "DELETE",
    module: "Asset",
    recordId: req.params.id,
    recordLabel: asset.assetId,
  });

  ok(res, null, "Asset deleted");
});
