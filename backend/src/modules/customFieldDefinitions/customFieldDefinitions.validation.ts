import { z } from "zod";
import { CUSTOM_FIELD_MODULES, CUSTOM_FIELD_TYPES } from "../../models/CustomFieldDefinition";

export const createCustomFieldDefinitionSchema = z.object({
  module: z.enum(CUSTOM_FIELD_MODULES),
  label: z.string().min(1),
  type: z.enum(CUSTOM_FIELD_TYPES),
  options: z.array(z.string().min(1)).optional().default([]),
  required: z.boolean().optional().default(false),
  order: z.coerce.number().int().optional().default(0),
});

export const updateCustomFieldDefinitionSchema = z.object({
  label: z.string().min(1).optional(),
  type: z.enum(CUSTOM_FIELD_TYPES).optional(),
  options: z.array(z.string().min(1)).optional(),
  required: z.boolean().optional(),
  order: z.coerce.number().int().optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const listCustomFieldDefinitionsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().max(100).optional(),
  module: z.enum(CUSTOM_FIELD_MODULES).optional(),
  status: z.enum(["Active", "Inactive"]).optional(),
});

export const customFieldDefinitionIdParamsSchema = z.object({
  id: z.string().min(1),
});
