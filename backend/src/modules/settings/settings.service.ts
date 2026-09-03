import fs from "node:fs";
import path from "node:path";
import { SystemSettings, type ISystemSettings } from "../../models/SystemSettings";
import { BASELINE_POLICY, type PasswordPolicy } from "../../utils/passwordPolicy";
import { ApiError } from "../../utils/ApiError";
import { basicUserDefaultPermissions, type PermissionsShape } from "../../config/permissions";
import { getEffectiveTurnstileKeys } from "../platformSettings/platformSettings.service";
import { BRANDING_DIR } from "../../utils/upload";

// SVG intentionally not accepted for new uploads (see utils/upload.ts's uploadLogo comment - it's
// the one image format that can execute script, and this file is served back publicly/
// unauthenticated). ".svg" stays in this cleanup list so removeExistingLogoFiles still removes a
// logo an org uploaded before this restriction existed, rather than leaving an orphaned file.
const LOGO_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg"];
const MIME_TO_EXT: Record<string, string> = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
};

function removeExistingLogoFiles(organizationId: string) {
  for (const ext of LOGO_EXTENSIONS) {
    const filePath = path.join(BRANDING_DIR, `logo-${organizationId}${ext}`);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

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
  changeWarningEnabled: false,
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
  passwordMinLength: BASELINE_POLICY.minLength,
  passwordRequireUppercase: BASELINE_POLICY.requireUppercase,
  passwordRequireNumber: BASELINE_POLICY.requireNumber,
  passwordRequireSpecialChar: BASELINE_POLICY.requireSpecialChar,
  passwordHistoryLimit: BASELINE_POLICY.historyLimit,
  passwordExpiryDays: 0,
  passwordExpiryWarningDays: 14,
  captchaEnabled: false,
  idleTimeoutMinutes: 30,
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
  if (input.captchaEnabled) {
    // Effective key - either a Super Admin's Global/Security Settings override or the .env
    // value (see platformSettings.service.ts#getEffectiveTurnstileKeys) - so an org can enable
    // CAPTCHA once a key has been provisioned through that new admin UI, even with no .env
    // value set at all.
    const { secretKey } = await getEffectiveTurnstileKeys();
    if (!secretKey) {
      throw new ApiError(400, "Configure a Turnstile site/secret key pair (Global Settings > Security, or TURNSTILE_SITE_KEY/TURNSTILE_SECRET_KEY on the server) first.");
    }
  }

  const settings = await getSettings(organizationId);
  Object.assign(settings, input);
  await settings.save();
  return settings;
}

/** The single place that decides what a newly-created employee's starting permissions are - an
 * org's own configured template (Administration > Settings > Employee Default Permissions) if
 * they've ever saved one, else the app's baseline (config/permissions.ts#basicUserDefaultPermissions).
 * Used by users.service.ts#createUser (both the single "Add user" flow and bulk import, which no
 * longer carries its own separate copy) and the "Bulk Update Permissions" action. */
export async function getDefaultEmployeePermissions(organizationId: string): Promise<PermissionsShape> {
  const settings = await getSettings(organizationId);
  return settings.defaultEmployeePermissions ?? basicUserDefaultPermissions();
}

/** 0 = disabled. Used only by middleware/authenticate.ts's sliding idle-timeout check - kept as
 * its own tiny lookup (not bundled into getPasswordPolicy) since it's read on every single
 * authenticated request, not just login/password-change flows. */
export async function getIdleTimeoutMinutes(organizationId: string): Promise<number> {
  const settings = await getSettings(organizationId);
  return settings.idleTimeoutMinutes;
}

export async function getPasswordPolicy(organizationId: string): Promise<PasswordPolicy> {
  const settings = await getSettings(organizationId);
  return {
    minLength: settings.passwordMinLength,
    requireUppercase: settings.passwordRequireUppercase,
    requireNumber: settings.passwordRequireNumber,
    requireSpecialChar: settings.passwordRequireSpecialChar,
    historyLimit: settings.passwordHistoryLimit,
  };
}

export async function getChangeWarningEnabled(organizationId: string): Promise<boolean> {
  const settings = await getSettings(organizationId);
  return settings.changeWarningEnabled;
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

/** Shared file-handling for a logo upload, used by both the org-scoped
 * /settings/logo route (settings.controller.ts) and the Sub-Super Admin's
 * /my-organizations/:id/logo route (subSuperAdmins.service.ts) - keeps the actual disk I/O in
 * one place so both callers can't drift apart on filename convention or cleanup behavior. */
export async function saveLogoFile(organizationId: string, file: { buffer: Buffer; mimetype: string }) {
  const ext = MIME_TO_EXT[file.mimetype];
  if (!ext) throw new ApiError(400, "Unsupported file type");

  const fileName = `logo-${organizationId}${ext}`;
  removeExistingLogoFiles(organizationId);
  fs.writeFileSync(path.join(BRANDING_DIR, fileName), file.buffer);

  return setLogo(organizationId, fileName);
}

/** Shared file-handling for logo removal - see saveLogoFile's comment. */
export async function removeLogoFile(organizationId: string) {
  removeExistingLogoFiles(organizationId);
  return clearLogo(organizationId);
}
