import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import * as searchService from "./search.service";

export const search = asyncHandler(async (req: Request, res: Response) => {
  const { q } = req.query as unknown as { q: string };

  const results = await searchService.searchOrganization(
    {
      organizationId: req.organization!._id,
      userId: req.user!.id,
      role: req.user!.role,
      isAdmin: req.user!.isAdmin,
      enabledModules: req.organization!.enabledModules,
      permissions: req.user!.permissions,
    },
    q
  );

  ok(res, results, "Search results");
});
