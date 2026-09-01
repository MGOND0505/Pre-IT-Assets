import { Router } from "express";
import { authorize, requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as customFieldDefinitionsController from "./customFieldDefinitions.controller";
import {
  createCustomFieldDefinitionSchema,
  customFieldDefinitionIdParamsSchema,
  listCustomFieldDefinitionsQuerySchema,
  updateCustomFieldDefinitionSchema,
} from "./customFieldDefinitions.validation";

export const customFieldDefinitionsRouter = Router();

customFieldDefinitionsRouter.get(
  "/deleted",
  requireAdmin,
  validate({ query: listCustomFieldDefinitionsQuerySchema }),
  customFieldDefinitionsController.listDeletedCustomFieldDefinitions
);
customFieldDefinitionsRouter.get(
  "/",
  authorize("customFields", "view"),
  validate({ query: listCustomFieldDefinitionsQuerySchema }),
  customFieldDefinitionsController.listCustomFieldDefinitions
);
customFieldDefinitionsRouter.post(
  "/",
  authorize("customFields", "create"),
  validate({ body: createCustomFieldDefinitionSchema }),
  customFieldDefinitionsController.createCustomFieldDefinition
);
customFieldDefinitionsRouter.get(
  "/:id",
  authorize("customFields", "view"),
  validate({ params: customFieldDefinitionIdParamsSchema }),
  customFieldDefinitionsController.getCustomFieldDefinition
);
customFieldDefinitionsRouter.put(
  "/:id",
  authorize("customFields", "update"),
  validate({ params: customFieldDefinitionIdParamsSchema, body: updateCustomFieldDefinitionSchema }),
  customFieldDefinitionsController.updateCustomFieldDefinition
);
customFieldDefinitionsRouter.delete(
  "/:id",
  authorize("customFields", "delete"),
  validate({ params: customFieldDefinitionIdParamsSchema }),
  customFieldDefinitionsController.deleteCustomFieldDefinition
);
customFieldDefinitionsRouter.post(
  "/:id/restore",
  requireAdmin,
  validate({ params: customFieldDefinitionIdParamsSchema }),
  customFieldDefinitionsController.restoreCustomFieldDefinition
);
