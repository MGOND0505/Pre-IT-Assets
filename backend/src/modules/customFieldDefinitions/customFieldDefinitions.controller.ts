import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as customFieldDefinitionsService from "./customFieldDefinitions.service";

export const listCustomFieldDefinitions = asyncHandler(async (req: Request, res: Response) => {
  const result = await customFieldDefinitionsService.listCustomFieldDefinitions(req.query as never, req.organization!._id);
  ok(res, result, "Custom fields");
});

export const getCustomFieldDefinition = asyncHandler(async (req: Request, res: Response) => {
  const definition = await customFieldDefinitionsService.getCustomFieldDefinitionById(req.params.id, req.organization!._id);
  ok(res, definition, "Custom field");
});

export const createCustomFieldDefinition = asyncHandler(async (req: Request, res: Response) => {
  const definition = await customFieldDefinitionsService.createCustomFieldDefinition(req.body, req.organization!._id);

  await logAction({
    req,
    action: "CREATE",
    module: "CustomFieldDefinition",
    recordId: definition.id,
    recordLabel: definition.label,
    newValue: req.body,
  });

  ok(res, definition, "Custom field created", 201);
});

export const updateCustomFieldDefinition = asyncHandler(async (req: Request, res: Response) => {
  const before = await customFieldDefinitionsService.getCustomFieldDefinitionById(req.params.id, req.organization!._id);
  const oldValue = { label: before.label, type: before.type, options: before.options, required: before.required, order: before.order, status: before.status };

  const definition = await customFieldDefinitionsService.updateCustomFieldDefinition(req.params.id, req.body, req.organization!._id);

  await logAction({
    req,
    action: "UPDATE",
    module: "CustomFieldDefinition",
    recordId: definition.id,
    recordLabel: definition.label,
    oldValue,
    newValue: req.body,
  });

  ok(res, definition, "Custom field updated");
});

export const deleteCustomFieldDefinition = asyncHandler(async (req: Request, res: Response) => {
  const definition = await customFieldDefinitionsService.deleteCustomFieldDefinition(req.params.id, req.user!.id, req.organization!._id);

  await logAction({
    req,
    action: "DELETE",
    module: "CustomFieldDefinition",
    recordId: req.params.id,
    recordLabel: definition.label,
  });

  ok(res, null, "Custom field deleted");
});

export const listDeletedCustomFieldDefinitions = asyncHandler(async (req: Request, res: Response) => {
  const result = await customFieldDefinitionsService.listCustomFieldDefinitions(
    { ...(req.query as unknown as Record<string, unknown>), includeDeleted: true },
    req.organization!._id
  );
  ok(res, result, "Deleted custom fields");
});

export const restoreCustomFieldDefinition = asyncHandler(async (req: Request, res: Response) => {
  const definition = await customFieldDefinitionsService.restoreCustomFieldDefinition(req.params.id, req.organization!._id);

  await logAction({ req, action: "RESTORE", module: "CustomFieldDefinition", recordId: definition.id, recordLabel: definition.label });

  ok(res, definition, "Custom field restored");
});
