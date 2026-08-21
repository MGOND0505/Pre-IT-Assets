import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as assetCategoriesService from "./assetCategories.service";

export const listAssetCategories = asyncHandler(async (req: Request, res: Response) => {
  const result = await assetCategoriesService.listAssetCategories(req.query as never);
  ok(res, result, "Asset categories");
});

export const getAssetCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await assetCategoriesService.getAssetCategoryById(req.params.id);
  ok(res, category, "Asset category");
});

export const createAssetCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await assetCategoriesService.createAssetCategory(req.body);

  await logAction({
    req,
    action: "CREATE",
    module: "AssetCategory",
    recordId: category.id,
    recordLabel: category.name,
    newValue: req.body,
  });

  ok(res, category, "Asset category created", 201);
});

export const updateAssetCategory = asyncHandler(async (req: Request, res: Response) => {
  const before = await assetCategoriesService.getAssetCategoryById(req.params.id);
  const oldValue = { name: before.name, prefix: before.prefix, description: before.description, status: before.status };

  const category = await assetCategoriesService.updateAssetCategory(req.params.id, req.body);

  await logAction({
    req,
    action: "UPDATE",
    module: "AssetCategory",
    recordId: category.id,
    recordLabel: category.name,
    oldValue,
    newValue: req.body,
  });

  ok(res, category, "Asset category updated");
});

export const deleteAssetCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await assetCategoriesService.deleteAssetCategory(req.params.id);

  await logAction({
    req,
    action: "DELETE",
    module: "AssetCategory",
    recordId: req.params.id,
    recordLabel: category.name,
  });

  ok(res, null, "Asset category deleted");
});
