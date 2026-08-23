import { SystemSettings, type ISystemSettings } from "../../models/SystemSettings";

/** Singleton: there is always exactly one settings document, created lazily on first read. */
export async function getSettings() {
  const existing = await SystemSettings.findOne();
  if (!existing) return SystemSettings.create({});

  // Backfill fields added after the singleton was first created (schema defaults
  // only apply to brand-new documents, not ones already persisted without the field).
  let needsSave = false;
  if (existing.assetIdCompanyPrefix === undefined) {
    existing.assetIdCompanyPrefix = "VNR";
    needsSave = true;
  }
  if (existing.licenseNextSequence === undefined) {
    existing.licenseNextSequence = 1;
    needsSave = true;
  }
  if (needsSave) await existing.save();

  return existing;
}

/** Atomically claims the next license ID sequence number. */
export async function claimNextLicenseSequence(): Promise<{ prefix: string; sequence: number }> {
  await getSettings(); // ensure the singleton (and its backfilled fields) exists first
  const settings = await SystemSettings.findOneAndUpdate({}, { $inc: { licenseNextSequence: 1 } }, { new: false });
  return { prefix: settings!.licenseIdPrefix, sequence: settings!.licenseNextSequence };
}

export async function updateSettings(input: Partial<ISystemSettings>) {
  const settings = await getSettings();
  Object.assign(settings, input);
  await settings.save();
  return settings;
}
