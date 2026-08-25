import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as helpdeskCategoriesService from "./helpdeskCategories.service";

export const listHelpdeskCategories = asyncHandler(async (req: Request, res: Response) => {
  const result = await helpdeskCategoriesService.listHelpdeskCategories(req.query as never, req.organization!._id);
  ok(res, result, "Helpdesk categories");
});

export const getHelpdeskCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await helpdeskCategoriesService.getHelpdeskCategoryById(req.params.id, req.organization!._id);
  ok(res, category, "Helpdesk category");
});

export const createHelpdeskCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await helpdeskCategoriesService.createHelpdeskCategory(req.body, req.organization!._id);

  await logAction({
    req,
    action: "CREATE",
    module: "HelpdeskCategory",
    recordId: category.id,
    recordLabel: category.name,
    newValue: req.body,
  });

  ok(res, category, "Helpdesk category created", 201);
});

export const updateHelpdeskCategory = asyncHandler(async (req: Request, res: Response) => {
  const before = await helpdeskCategoriesService.getHelpdeskCategoryById(req.params.id, req.organization!._id);
  const oldValue = { name: before.name, description: before.description, status: before.status };

  const category = await helpdeskCategoriesService.updateHelpdeskCategory(req.params.id, req.body, req.organization!._id);

  await logAction({
    req,
    action: "UPDATE",
    module: "HelpdeskCategory",
    recordId: category.id,
    recordLabel: category.name,
    oldValue,
    newValue: req.body,
  });

  ok(res, category, "Helpdesk category updated");
});

export const deleteHelpdeskCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await helpdeskCategoriesService.deleteHelpdeskCategory(req.params.id, req.user!.id, req.organization!._id);

  await logAction({
    req,
    action: "DELETE",
    module: "HelpdeskCategory",
    recordId: req.params.id,
    recordLabel: category.name,
  });

  ok(res, null, "Helpdesk category deleted");
});

export const listDeletedHelpdeskCategories = asyncHandler(async (req: Request, res: Response) => {
  const result = await helpdeskCategoriesService.listHelpdeskCategories(
    { ...(req.query as unknown as Record<string, unknown>), includeDeleted: true },
    req.organization!._id
  );
  ok(res, result, "Deleted helpdesk categories");
});

export const restoreHelpdeskCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await helpdeskCategoriesService.restoreHelpdeskCategory(req.params.id, req.organization!._id);

  await logAction({ req, action: "RESTORE", module: "HelpdeskCategory", recordId: category.id, recordLabel: category.name });

  ok(res, category, "Helpdesk category restored");
});
