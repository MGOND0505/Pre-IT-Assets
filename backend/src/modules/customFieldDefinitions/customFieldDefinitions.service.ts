import {
  CustomFieldDefinition,
  type CustomFieldModule,
  type CustomFieldType,
  type ICustomFieldDefinition,
} from "../../models/CustomFieldDefinition";
import { ApiError } from "../../utils/ApiError";
import { getOrgRetentionDays, withRecycleBinMeta } from "../../utils/recycleBin";
import { escapeRegex } from "../../utils/regex";

type ListInput = {
  page?: number;
  limit?: number;
  search?: string;
  module?: CustomFieldModule;
  status?: "Active" | "Inactive";
  includeDeleted?: boolean;
};

export async function listCustomFieldDefinitions(input: ListInput, organizationId: string) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = { organization: organizationId, isDeleted: input.includeDeleted ? true : false };
  if (input.module) filter.module = input.module;
  if (input.status) filter.status = input.status;
  if (input.search) filter.label = { $regex: escapeRegex(input.search), $options: "i" };

  const [items, total] = await Promise.all([
    CustomFieldDefinition.find(filter)
      .sort({ module: 1, order: 1, label: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    CustomFieldDefinition.countDocuments(filter),
  ]);

  const retentionDays = await getOrgRetentionDays(organizationId);
  return { items: withRecycleBinMeta(items, retentionDays), total, page, limit, totalPages: Math.ceil(total / limit) };
}

export async function getCustomFieldDefinitionById(id: string, organizationId: string) {
  const definition = await CustomFieldDefinition.findOne({ organization: organizationId, _id: id, isDeleted: false });
  if (!definition) throw new ApiError(404, "Custom field not found");
  return definition;
}

async function assertLabelAvailable(organizationId: string, module: CustomFieldModule, label: string | undefined, excludeId?: string) {
  if (!label) return;
  const existing = await CustomFieldDefinition.findOne({
    organization: organizationId,
    module,
    label,
    isDeleted: false,
    _id: { $ne: excludeId },
  });
  if (existing) throw new ApiError(409, "A custom field with this label already exists for this module");
}

async function assertKeyAvailable(organizationId: string, module: CustomFieldModule, key: string, excludeId?: string) {
  const existing = await CustomFieldDefinition.findOne({
    organization: organizationId,
    module,
    key,
    isDeleted: false,
    _id: { $ne: excludeId },
  });
  if (existing) throw new ApiError(409, "A custom field with this label already exists for this module");
}

/** Lowercases, replaces anything that isn't alphanumeric with an underscore, collapses repeats,
 * and trims leading/trailing underscores - e.g. "Serial Warranty" -> "serial_warranty". This is
 * the ONLY place `key` is ever derived; it's never accepted from the client. */
function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

type CreateInput = {
  module: CustomFieldModule;
  label: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
  order?: number;
};

export async function createCustomFieldDefinition(input: CreateInput, organizationId: string) {
  await assertLabelAvailable(organizationId, input.module, input.label);

  const key = slugify(input.label);
  if (!key) throw new ApiError(400, "Label must contain at least one letter or number");
  await assertKeyAvailable(organizationId, input.module, key);

  return CustomFieldDefinition.create({
    organization: organizationId,
    module: input.module,
    label: input.label,
    key,
    type: input.type,
    options: input.type === "select" ? (input.options ?? []) : [],
    required: input.required ?? false,
    order: input.order ?? 0,
  });
}

type UpdateInput = Partial<{
  label: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
  order: number;
  status: "Active" | "Inactive";
}>;

export async function updateCustomFieldDefinition(id: string, input: UpdateInput, organizationId: string) {
  const definition = await getCustomFieldDefinitionById(id, organizationId);
  await assertLabelAvailable(organizationId, definition.module, input.label, id);

  // `key` is server-derived and immutable - never touched here even though `label` (its source)
  // can change, so existing stored values on Asset/License/Ticket.customFields stay keyed
  // correctly.
  const nextType = input.type ?? definition.type;
  Object.assign(definition, input);
  definition.options = nextType === "select" ? (input.options ?? definition.options ?? []) : [];
  await definition.save();
  return definition;
}

/** Soft delete: hidden from normal listings but recoverable via the Recycle Bin. */
export async function deleteCustomFieldDefinition(id: string, deletedBy: string, organizationId: string) {
  const definition = await getCustomFieldDefinitionById(id, organizationId);
  definition.isDeleted = true;
  definition.deletedAt = new Date();
  definition.deletedBy = deletedBy as unknown as ICustomFieldDefinition["deletedBy"];
  await definition.save();
  return definition;
}

export async function restoreCustomFieldDefinition(id: string, organizationId: string) {
  const definition = await CustomFieldDefinition.findOne({ organization: organizationId, _id: id, isDeleted: true });
  if (!definition) throw new ApiError(404, "Deleted custom field not found");
  await assertLabelAvailable(organizationId, definition.module, definition.label, id);
  await assertKeyAvailable(organizationId, definition.module, definition.key, id);

  definition.isDeleted = false;
  definition.deletedAt = null;
  definition.deletedBy = null;
  await definition.save();
  return definition;
}
