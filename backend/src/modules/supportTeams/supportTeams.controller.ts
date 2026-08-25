import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as supportTeamsService from "./supportTeams.service";

export const listSupportTeams = asyncHandler(async (req: Request, res: Response) => {
  const result = await supportTeamsService.listSupportTeams(req.query as never, req.organization!._id);
  ok(res, result, "Support teams");
});

export const getSupportTeam = asyncHandler(async (req: Request, res: Response) => {
  const team = await supportTeamsService.getSupportTeamById(req.params.id, req.organization!._id);
  ok(res, team, "Support team");
});

export const createSupportTeam = asyncHandler(async (req: Request, res: Response) => {
  const team = await supportTeamsService.createSupportTeam(req.body, req.organization!._id);

  await logAction({
    req,
    action: "CREATE",
    module: "SupportTeam",
    recordId: team.id,
    recordLabel: team.name,
    newValue: req.body,
  });

  ok(res, team, "Support team created", 201);
});

export const updateSupportTeam = asyncHandler(async (req: Request, res: Response) => {
  const team = await supportTeamsService.updateSupportTeam(req.params.id, req.body, req.organization!._id);

  await logAction({
    req,
    action: "UPDATE",
    module: "SupportTeam",
    recordId: team.id,
    recordLabel: team.name,
    newValue: req.body,
  });

  ok(res, team, "Support team updated");
});

export const deleteSupportTeam = asyncHandler(async (req: Request, res: Response) => {
  const team = await supportTeamsService.deleteSupportTeam(req.params.id, req.user!.id, req.organization!._id);

  await logAction({
    req,
    action: "DELETE",
    module: "SupportTeam",
    recordId: req.params.id,
    recordLabel: team.name,
  });

  ok(res, null, "Support team deleted");
});

export const listDeletedSupportTeams = asyncHandler(async (req: Request, res: Response) => {
  const result = await supportTeamsService.listSupportTeams(
    { ...(req.query as unknown as Record<string, unknown>), includeDeleted: true },
    req.organization!._id
  );
  ok(res, result, "Deleted support teams");
});

export const restoreSupportTeam = asyncHandler(async (req: Request, res: Response) => {
  const team = await supportTeamsService.restoreSupportTeam(req.params.id, req.organization!._id);

  await logAction({ req, action: "RESTORE", module: "SupportTeam", recordId: team.id, recordLabel: team.name });

  ok(res, team, "Support team restored");
});
