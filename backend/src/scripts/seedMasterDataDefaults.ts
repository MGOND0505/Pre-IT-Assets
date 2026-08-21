import { AssetCategory } from "../models/AssetCategory";
import { LicenseCategory } from "../models/LicenseCategory";
import { DEFAULT_ASSET_CATEGORIES, DEFAULT_LICENSE_CATEGORIES } from "../config/masterDataDefaults";

/**
 * Idempotent, additive-only: seeds the spec's default asset/license categories
 * if they don't already exist by name. Never overwrites an existing category
 * (an admin may have renamed/repurposed its prefix or description).
 */
export async function ensureMasterDataDefaults(): Promise<void> {
  for (const def of DEFAULT_ASSET_CATEGORIES) {
    const existing = await AssetCategory.findOne({ name: def.name });
    if (!existing) {
      await AssetCategory.create({ name: def.name, prefix: def.prefix });
    }
  }

  for (const name of DEFAULT_LICENSE_CATEGORIES) {
    const existing = await LicenseCategory.findOne({ name });
    if (!existing) {
      await LicenseCategory.create({ name });
    }
  }
}
