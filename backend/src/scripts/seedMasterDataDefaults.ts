import { AssetCategory } from "../models/AssetCategory";
import { LicenseCategory } from "../models/LicenseCategory";
import { Organization } from "../models/Organization";
import { DEFAULT_ASSET_CATEGORIES, DEFAULT_LICENSE_CATEGORIES } from "../config/masterDataDefaults";

/**
 * Idempotent, additive-only: seeds the spec's default asset/license categories for one
 * organization if they don't already exist by name within it. Never overwrites an existing
 * category (an admin may have renamed/repurposed its prefix or description).
 */
export async function ensureDefaultsForOrg(organizationId: string): Promise<void> {
  for (const def of DEFAULT_ASSET_CATEGORIES) {
    const existing = await AssetCategory.findOne({ organization: organizationId, name: def.name });
    if (!existing) {
      await AssetCategory.create({ organization: organizationId, name: def.name, prefix: def.prefix });
    }
  }

  for (const name of DEFAULT_LICENSE_CATEGORIES) {
    const existing = await LicenseCategory.findOne({ organization: organizationId, name });
    if (!existing) {
      await LicenseCategory.create({ organization: organizationId, name });
    }
  }
}

/** Runs once per active organization on server startup - harmless/no-op for an org that
 * already has its categories (the common case; new orgs get their defaults automatically). */
export async function ensureMasterDataDefaults(): Promise<void> {
  const organizations = await Organization.find({ status: "Active", isDeleted: false }).select("_id");
  for (const org of organizations) {
    await ensureDefaultsForOrg(String(org._id));
  }
}
