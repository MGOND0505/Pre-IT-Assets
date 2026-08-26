import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok, fail } from "../../utils/response";
import * as analyticsService from "./analytics.service";

export const getEmbedUrl = asyncHandler(async (req: Request, res: Response) => {
  const result = analyticsService.getAnalyticsEmbedUrl(req.organization!._id);
  if (!result) {
    fail(res, "Analytics embedding is not configured for this environment", 501);
    return;
  }
  ok(res, result, "Analytics embed URL");
});
