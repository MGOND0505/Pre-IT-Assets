import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import { createNotification } from "../notifications/notifications.service";
import { Asset } from "../../models/Asset";
import * as assetWorkflowService from "./assetWorkflow.service";
import { listAssetHistory } from "./assetHistory.service";

export const assignAsset = asyncHandler(async (req: Request, res: Response) => {
  const asset = await assetWorkflowService.assignAsset(req.params.id, req.body, req.user!.id);

  await logAction({ req, action: "ASSIGN", module: "Asset", recordId: asset.id, recordLabel: asset.assetId });

  if (req.body.assignedTo) {
    await createNotification({
      recipients: [req.body.assignedTo],
      type: "ASSET_ASSIGNED",
      title: "Asset assigned to you",
      message: `${asset.name} (${asset.assetId}) has been assigned to you.`,
      relatedModule: "Asset",
      relatedId: asset.id,
    });
  }

  ok(res, asset, "Asset assigned");
});

export const transferAsset = asyncHandler(async (req: Request, res: Response) => {
  const asset = await assetWorkflowService.transferAsset(req.params.id, req.body, req.user!.id);

  await logAction({ req, action: "TRANSFER", module: "Asset", recordId: asset.id, recordLabel: asset.assetId });

  if (req.body.toUser) {
    await createNotification({
      recipients: [req.body.toUser],
      type: "ASSET_TRANSFERRED",
      title: "Asset transferred to you",
      message: `${asset.name} (${asset.assetId}) has been transferred to you.`,
      relatedModule: "Asset",
      relatedId: asset.id,
    });
  }

  ok(res, asset, "Asset transferred");
});

export const returnAsset = asyncHandler(async (req: Request, res: Response) => {
  const before = await Asset.findById(req.params.id).select("assignedUser");
  const previousAssignee = before?.assignedUser ?? null;

  const asset = await assetWorkflowService.returnAsset(req.params.id, req.body, req.user!.id);

  await logAction({ req, action: "RETURN", module: "Asset", recordId: asset.id, recordLabel: asset.assetId });

  if (previousAssignee) {
    await createNotification({
      recipients: [String(previousAssignee)],
      type: "ASSET_RETURNED",
      title: "Asset return recorded",
      message: `${asset.name} (${asset.assetId}) has been marked as returned.`,
      relatedModule: "Asset",
      relatedId: asset.id,
    });
  }

  ok(res, asset, "Asset returned");
});

export const retireAsset = asyncHandler(async (req: Request, res: Response) => {
  const asset = await assetWorkflowService.retireAsset(req.params.id, req.body, req.user!.id);

  await logAction({ req, action: "RETIRE", module: "Asset", recordId: asset.id, recordLabel: asset.assetId });

  ok(res, asset, "Asset retired");
});

export const getAssetHistory = asyncHandler(async (req: Request, res: Response) => {
  const history = await listAssetHistory(req.params.id);
  ok(res, history, "Asset history");
});
