import {
  CustomFieldDefinition,
  type CustomFieldModule,
  type CustomFieldType,
  type ICustomFieldDefinition,
} from "../../models/CustomFieldDefinition";
import type { UserRole } from "../../models/User";
import { ApiError } from "../../utils/ApiError";
import { getOrgRetentionDays, withRecycleBinMeta } from "../../utils/recycleBin";
import { tokenSearchFilter } from "../../utils/smartSearch";

type RequestingUser = { role: UserRole };

/** Assets/Licenses/Vendors custom fields are Super Admin/Sub-Super Admin-only, per the
 * Organization-Wise Custom Field Management spec - Helpdesk is deliberately excluded (never
 * mentioned by either this or the earlier Asset-only spec), so it keeps today's normal
 * isAdmin/Team-Member-grant behavior. Even though Org Admin's isAdmin bypass and a Team Member's
 * granted `customFields` permission already got them past the route-level authorize() check above
 * this, that check must not be sufficient for a restricted module. A Sub-Super Admin reaching this
 * point already had their real per-org grant checked by that same authorize() call, so only the
 * role itself needs re-checking here. */
const RESTRICTED_CUSTOM_FIELD_MODULES: readonly CustomFieldModule[] = ["assets", "licenses", "vendors"];

function assertCanConfigureIfRestrictedModule(module: CustomFieldModule, requestingUser: RequestingUser) {
  if (!RESTRICTED_CUSTOM_FIELD_MODULES.includes(module)) return;
  if (requestingUser.role === "superAdmin" || requestingUser.role === "subSuperAdmin") return;
  throw new ApiError(403, "Only a Super Admin or Sub-Super Admin can configure this module's custom fields");
}

type ListInput = {
  page?: number;
  limit?: number;
  search?: string;
  module?: CustomFieldModule;
  status?: "Active" | "Inactive";
  includeDeleted?: boolean;
  // Exact-match scope filter, for the admin management UI: unset = no filter, "" = only
  // module-wide (category: null) definitions, any other value = only that exact category.
  category?: string;
  // "Applicable to this category" filter, for rendering a category's asset form: returns
  // module-wide (category: null) definitions PLUS this exact category's own definitions.
  // Mutually exclusive with `category` in practice - if both are set, `category` wins.
  applicableToCategory?: string;
};

export async function listCustomFieldDefinitions(input: ListInput, organizationId: string) {
  const page = input.page ?? 1;
  const limit = input.limit ?? 20;

  const filter: Record<string, unknown> = { organization: organizationId, isDeleted: input.includeDeleted ? true : false };
  if (input.module) filter.module = input.module;
  if (input.status) filter.status = input.status;
  if (input.category !== undefined) {
    filter.category = input.category === "" ? null : input.category;
  } else if (input.applicableToCategory) {
    filter.category = { $in: [null, input.applicableToCategory] };
  }
  if (input.search) Object.assign(filter, tokenSearchFilter(["label"], input.search));

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

async function assertLabelAvailable(
  organizationId: string,
  module: CustomFieldModule,
  category: string | null | undefined,
  label: string | undefined,
  excludeId?: string
) {
  if (!label) return;
  const existing = await CustomFieldDefinition.findOne({
    organization: organizationId,
    module,
    category: category ?? null,
    label,
    isDeleted: false,
    _id: { $ne: excludeId },
  });
  if (existing) throw new ApiError(409, "A custom field with this label already exists for this scope");
}

async function assertKeyAvailable(
  organizationId: string,
  module: CustomFieldModule,
  category: string | null | undefined,
  key: string,
  excludeId?: string
) {
  const existing = await CustomFieldDefinition.findOne({
    organization: organizationId,
    module,
    category: category ?? null,
    key,
    isDeleted: false,
    _id: { $ne: excludeId },
  });
  if (existing) throw new ApiError(409, "A custom field with this label already exists for this scope");
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
  category?: string | null;
  label: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
  order?: number;
};

export async function createCustomFieldDefinition(input: CreateInput, organizationId: string, requestingUser: RequestingUser) {
  assertCanConfigureIfRestrictedModule(input.module, requestingUser);
  const category = input.category ?? null;
  await assertLabelAvailable(organizationId, input.module, category, input.label);

  const key = slugify(input.label);
  if (!key) throw new ApiError(400, "Label must contain at least one letter or number");
  await assertKeyAvailable(organizationId, input.module, category, key);

  return CustomFieldDefinition.create({
    organization: organizationId,
    module: input.module,
    category,
    label: input.label,
    key,
    type: input.type,
    options: input.type === "select" ? (input.options ?? []) : [],
    required: input.required ?? false,
    order: input.order ?? 0,
  });
}

type UpdateInput = Partial<{
  category: string | null;
  label: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
  order: number;
  status: "Active" | "Inactive";
}>;

export async function updateCustomFieldDefinition(
  id: string,
  input: UpdateInput,
  organizationId: string,
  requestingUser: RequestingUser
) {
  const definition = await getCustomFieldDefinitionById(id, organizationId);
  assertCanConfigureIfRestrictedModule(definition.module, requestingUser);
  const nextCategory = "category" in input ? (input.category ?? null) : String(definition.category ?? "") || null;
  await assertLabelAvailable(organizationId, definition.module, nextCategory, input.label, id);
  // A category move (not just a label edit) can collide with an existing definition of the same
  // (server-derived, immutable) key that already lives in the destination category.
  if ("category" in input) await assertKeyAvailable(organizationId, definition.module, nextCategory, definition.key, id);

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
export async function deleteCustomFieldDefinition(
  id: string,
  deletedBy: string,
  organizationId: string,
  requestingUser: RequestingUser
) {
  const definition = await getCustomFieldDefinitionById(id, organizationId);
  assertCanConfigureIfRestrictedModule(definition.module, requestingUser);
  definition.isDeleted = true;
  definition.deletedAt = new Date();
  definition.deletedBy = deletedBy as unknown as ICustomFieldDefinition["deletedBy"];
  await definition.save();
  return definition;
}

export async function restoreCustomFieldDefinition(id: string, organizationId: string, requestingUser: RequestingUser) {
  const definition = await CustomFieldDefinition.findOne({ organization: organizationId, _id: id, isDeleted: true });
  if (!definition) throw new ApiError(404, "Deleted custom field not found");
  assertCanConfigureIfRestrictedModule(definition.module, requestingUser);
  const category = String(definition.category ?? "") || null;
  await assertLabelAvailable(organizationId, definition.module, category, definition.label, id);
  await assertKeyAvailable(organizationId, definition.module, category, definition.key, id);

  definition.isDeleted = false;
  definition.deletedAt = null;
  definition.deletedBy = null;
  await definition.save();
  return definition;
}
