import { SystemSettings, type ISystemSettings } from "../../models/SystemSettings";

/** Defaults for fields added after the singleton was first created - schema defaults only
 * apply to brand-new documents, not ones already persisted without the field. */
const BACKFILL_DEFAULTS: Partial<ISystemSettings> = {
  assetIdCompanyPrefix: "VNR",
  licenseNextSequence: 1,
  helpdeskIdPrefix: "TCK",
  helpdeskNextSequence: 1,
  taskIdPrefix: "TSK",
  taskNextSequence: 1,
  logoFileName: "",
  teamName: "",
  sidebarColor: "",
  appBackgroundColor: "",
  alertEmails: [],
  alertEmailsCc: [],
  alertEmailsBcc: [],
  expiryAlertsEnabled: false,
  assetChangeAlertsEnabled: false,
  notificationChannel: "smtp",
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPassword: "",
  smtpSecure: false,
  smtpFromEmail: "",
  smtpFromName: "",
  m365TenantId: "",
  m365ClientId: "",
  m365ClientSecret: "",
  m365SenderEmail: "",
  googleServiceAccountEmail: "",
  googleServiceAccountPrivateKey: "",
  googleSenderEmail: "",
};

/** One settings document per organization, created lazily on first access. */
export async function getSettings(organizationId: string) {
  const existing = await SystemSettings.findOne({ organization: organizationId });
  if (!existing) return SystemSettings.create({ organization: organizationId });

  let needsSave = false;
  for (const [key, value] of Object.entries(BACKFILL_DEFAULTS)) {
    if (existing[key as keyof ISystemSettings] === undefined) {
      (existing as unknown as Record<string, unknown>)[key] = value;
      needsSave = true;
    }
  }
  if (needsSave) await existing.save();

  return existing;
}

/** Atomically claims the next license ID sequence number, scoped to one organization. */
export async function claimNextLicenseSequence(organizationId: string): Promise<{ prefix: string; sequence: number }> {
  await getSettings(organizationId); // ensure this org's doc (and its backfilled fields) exists first
  const settings = await SystemSettings.findOneAndUpdate(
    { organization: organizationId },
    { $inc: { licenseNextSequence: 1 } },
    { new: false }
  );
  return { prefix: settings!.licenseIdPrefix, sequence: settings!.licenseNextSequence };
}

/** Atomically claims the next ticket ID sequence number, scoped to one organization. */
export async function claimNextTicketSequence(organizationId: string): Promise<{ prefix: string; sequence: number }> {
  await getSettings(organizationId); // ensure this org's doc (and its backfilled fields) exists first
  const settings = await SystemSettings.findOneAndUpdate(
    { organization: organizationId },
    { $inc: { helpdeskNextSequence: 1 } },
    { new: false }
  );
  return { prefix: settings!.helpdeskIdPrefix, sequence: settings!.helpdeskNextSequence };
}

/** Atomically claims the next task ID sequence number, scoped to one organization. */
export async function claimNextTaskSequence(organizationId: string): Promise<{ prefix: string; sequence: number }> {
  await getSettings(organizationId); // ensure this org's doc (and its backfilled fields) exists first
  const settings = await SystemSettings.findOneAndUpdate(
    { organization: organizationId },
    { $inc: { taskNextSequence: 1 } },
    { new: false }
  );
  return { prefix: settings!.taskIdPrefix, sequence: settings!.taskNextSequence };
}

export async function updateSettings(organizationId: string, input: Partial<ISystemSettings>) {
  const settings = await getSettings(organizationId);
  Object.assign(settings, input);
  await settings.save();
  return settings;
}

export async function setLogo(organizationId: string, fileName: string) {
  const settings = await getSettings(organizationId);
  settings.logoFileName = fileName;
  await settings.save();
  return settings;
}

export async function clearLogo(organizationId: string) {
  const settings = await getSettings(organizationId);
  settings.logoFileName = "";
  await settings.save();
  return settings;
}
