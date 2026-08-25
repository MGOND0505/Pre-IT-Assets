import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as helpdeskPrioritiesService from "./helpdeskPriorities.service";

export const listHelpdeskPriorities = asyncHandler(async (req: Request, res: Response) => {
  const result = await helpdeskPrioritiesService.listHelpdeskPriorities(req.query as never, req.organization!._id);
  ok(res, result, "Helpdesk priorities");
});

export const getHelpdeskPriority = asyncHandler(async (req: Request, res: Response) => {
  const priority = await helpdeskPrioritiesService.getHelpdeskPriorityById(req.params.id, req.organization!._id);
  ok(res, priority, "Helpdesk priority");
});

export const createHelpdeskPriority = asyncHandler(async (req: Request, res: Response) => {
  const priority = await helpdeskPrioritiesService.createHelpdeskPriority(req.body, req.organization!._id);

  await logAction({
    req,
    action: "CREATE",
    module: "HelpdeskPriority",
    recordId: priority.id,
    recordLabel: priority.name,
    newValue: req.body,
  });

  ok(res, priority, "Helpdesk priority created", 201);
});

export const updateHelpdeskPriority = asyncHandler(async (req: Request, res: Response) => {
  const before = await helpdeskPrioritiesService.getHelpdeskPriorityById(req.params.id, req.organization!._id);
  const oldValue = {
    name: before.name,
    slaResponseMinutes: before.slaResponseMinutes,
    slaResolutionMinutes: before.slaResolutionMinutes,
    status: before.status,
  };

  const priority = await helpdeskPrioritiesService.updateHelpdeskPriority(req.params.id, req.body, req.organization!._id);

  await logAction({
    req,
    action: "UPDATE",
    module: "HelpdeskPriority",
    recordId: priority.id,
    recordLabel: priority.name,
    oldValue,
    newValue: req.body,
  });

  ok(res, priority, "Helpdesk priority updated");
});

export const deleteHelpdeskPriority = asyncHandler(async (req: Request, res: Response) => {
  const priority = await helpdeskPrioritiesService.deleteHelpdeskPriority(req.params.id, req.user!.id, req.organization!._id);

  await logAction({
    req,
    action: "DELETE",
    module: "HelpdeskPriority",
    recordId: req.params.id,
    recordLabel: priority.name,
  });

  ok(res, null, "Helpdesk priority deleted");
});

export const listDeletedHelpdeskPriorities = asyncHandler(async (req: Request, res: Response) => {
  const result = await helpdeskPrioritiesService.listHelpdeskPriorities(
    { ...(req.query as unknown as Record<string, unknown>), includeDeleted: true },
    req.organization!._id
  );
  ok(res, result, "Deleted helpdesk priorities");
});

export const restoreHelpdeskPriority = asyncHandler(async (req: Request, res: Response) => {
  const priority = await helpdeskPrioritiesService.restoreHelpdeskPriority(req.params.id, req.organization!._id);

  await logAction({ req, action: "RESTORE", module: "HelpdeskPriority", recordId: priority.id, recordLabel: priority.name });

  ok(res, priority, "Helpdesk priority restored");
});
