import { SystemSettings, type ISystemSettings } from "../../models/SystemSettings";

/** Singleton: there is always exactly one settings document, created lazily on first read. */
export async function getSettings() {
  const existing = await SystemSettings.findOne();
  if (!existing) return SystemSettings.create({});

  // Backfill fields added after the singleton was first created (schema defaults
  // only apply to brand-new documents, not ones already persisted without the field).
  if (existing.assetIdCompanyPrefix === undefined) {
    existing.assetIdCompanyPrefix = "VNR";
    await existing.save();
  }

  return existing;
}

export async function updateSettings(input: Partial<ISystemSettings>) {
  const settings = await getSettings();
  Object.assign(settings, input);
  await settings.save();
  return settings;
}
