import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as settingsService from "./settings.service";

export const getSettings = asyncHandler(async (_req: Request, res: Response) => {
  const settings = await settingsService.getSettings();
  ok(res, settings, "System settings");
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const before = await settingsService.getSettings();
  const oldValue = before.toObject();

  const settings = await settingsService.updateSettings(req.body);

  await logAction({
    req,
    action: "UPDATE",
    module: "SystemSettings",
    recordId: settings.id,
    recordLabel: "System settings",
    oldValue,
    newValue: req.body,
  });

  ok(res, settings, "System settings updated");
});
