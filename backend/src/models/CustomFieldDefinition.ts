import { Schema, model, type Types } from "mongoose";

export const CUSTOM_FIELD_MODULES = ["assets", "licenses", "helpdesk"] as const;
export type CustomFieldModule = (typeof CUSTOM_FIELD_MODULES)[number];

export const CUSTOM_FIELD_TYPES = ["text", "number", "date", "select", "checkbox"] as const;
export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

/** An org-defined extra field that gets rendered on (and enforced for) one of the three modules'
 * add/edit forms. `key` is a slug derived from `label` at creation time (see
 * customFieldDefinitions.service.ts's slugify) and is immutable afterwards - it's what the stored
 * value on an Asset/License/Ticket's `customFields` map is actually keyed by, so changing it after
 * values exist would silently orphan them. Mirrors Department/Designation in every other way (same
 * soft-delete/recycle-bin treatment). */
export interface ICustomFieldDefinition {
  organization: Types.ObjectId;
  module: CustomFieldModule;
  // null = applies to every asset in the module (the original, still-default behavior). Set only
  // meaningfully for module "assets" today - scopes the field to one AssetCategory (e.g. an "IMEI"
  // field that only appears on Mobile-category assets), per the category-based Assets redesign.
  category: Types.ObjectId | null;
  label: string;
  key: string;
  type: CustomFieldType;
  options: string[];
  required: boolean;
  order: number;
  status: "Active" | "Inactive";
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}

const customFieldDefinitionSchema = new Schema<ICustomFieldDefinition>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    module: { type: String, enum: CUSTOM_FIELD_MODULES, required: true, index: true },
    category: { type: Schema.Types.ObjectId, ref: "AssetCategory", default: null, index: true },
    label: { type: String, required: true, trim: true },
    key: { type: String, required: true },
    type: { type: String, enum: CUSTOM_FIELD_TYPES, required: true },
    options: { type: [String], default: [] },
    required: { type: Boolean, default: false },
    order: { type: Number, default: 0 },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

customFieldDefinitionSchema.index(
  { organization: 1, module: 1, category: 1, key: 1 },
  { unique: true, partialFilterExpression: { isDeleted: false } }
);

export const CustomFieldDefinition = model<ICustomFieldDefinition>("CustomFieldDefinition", customFieldDefinitionSchema);
