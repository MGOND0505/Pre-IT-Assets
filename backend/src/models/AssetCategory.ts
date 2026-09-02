import { Schema, model, type Types } from "mongoose";

// The higher-level grouping shown in the Assets module's category-based navigation (e.g. "IT
// Infrastructure" containing the Switch/Router/Firewall/CCTV/Access Point/Server categories) - a
// category (== "asset type" in ITAM terms) belongs to exactly one group. "Peripherals & Other" is
// the catch-all for categories that predate this grouping and don't fit the four named groups.
export const ASSET_CATEGORY_GROUPS = [
  "End-User Computing",
  "Mobile Devices",
  "Display & AV",
  "IT Infrastructure",
  "Peripherals & Other",
] as const;
export type AssetCategoryGroup = (typeof ASSET_CATEGORY_GROUPS)[number];

export interface IAssetCategory {
  organization: Types.ObjectId;
  name: string;
  prefix: string;
  description: string;
  nextSequence: number;
  status: "Active" | "Inactive";
  group: AssetCategoryGroup;
  // Which Asset Master Hardware/Security/Software field keys this category's create/edit form and
  // detail view show, ON TOP OF the always-shown common fields (Identification/Assignment/
  // Location/Procurement/Warranty - those are never hidden). `null` (the default) means
  // "uncurated - show every field," so a category nobody has configured yet behaves exactly like
  // before this feature existed. An empty array `[]` is a deliberate, curated choice meaning "show
  // none of the optional technical fields" (e.g. a TV needs none of them) - `null` and `[]` are NOT
  // interchangeable, only `null` falls back to "show everything".
  visibleCoreFields: string[] | null;
  // Which field/custom-field keys this category's asset list table shows when the list is filtered
  // to exactly this one category. `null` (the default) means "use the module's default column
  // set." Same null-vs-empty-array distinction as `visibleCoreFields`.
  listColumns: string[] | null;
}

const assetCategorySchema = new Schema<IAssetCategory>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    name: { type: String, required: true, trim: true },
    prefix: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      match: [/^[A-Z0-9]{2,6}$/, "Prefix must be 2-6 letters/digits"],
    },
    description: { type: String, default: "" },
    nextSequence: { type: Number, default: 1 },
    status: { type: String, enum: ["Active", "Inactive"], default: "Active" },
    group: { type: String, enum: ASSET_CATEGORY_GROUPS, default: "Peripherals & Other", index: true },
    visibleCoreFields: { type: [String], default: null },
    listColumns: { type: [String], default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

assetCategorySchema.index({ organization: 1, name: 1 }, { unique: true });
assetCategorySchema.index({ organization: 1, prefix: 1 }, { unique: true });

export const AssetCategory = model<IAssetCategory>("AssetCategory", assetCategorySchema);
