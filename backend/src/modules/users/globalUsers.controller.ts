import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import * as globalUsersService from "./globalUsers.service";

export const listGlobalUsers = asyncHandler(async (req: Request, res: Response) => {
  const result = await globalUsersService.listUsersAcrossOrgs(req.query as never);
  ok(res, result, "Users");
});
