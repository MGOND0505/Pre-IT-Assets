import fs from "node:fs";
import path from "node:path";
import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { ApiError } from "../../utils/ApiError";
import { BRANDING_DIR } from "../../utils/upload";
import { logAction } from "../audit/audit.service";
import { sendEmail } from "../../services/email";
import { renderTemplate, listTemplates } from "../../services/notifications/templates";
import { NotificationTemplate, NOTIFICATION_TEMPLATE_KEYS, type NotificationTemplateKey } from "../../models/NotificationTemplate";
import { NotificationLog } from "../../models/NotificationLog";
import * as settingsService from "./settings.service";
import type { ISystemSettings } from "../../models/SystemSettings";
import { env } from "../../config/env";

/** Secret fields that must never be echoed back to the client verbatim - only whether one is set. */
const SECRET_FIELDS = ["smtpPassword", "m365ClientSecret", "googleServiceAccountPrivateKey"] as const;

function maskSettings(settings: ISystemSettings & { toObject?: () => Record<string, unknown> }) {
  const plain = settings.toObject ? settings.toObject() : { ...settings };
  const masked: Record<string, unknown> = { ...plain };
  for (const field of SECRET_FIELDS) {
    masked[field] = "";
    masked[`${field}Set`] = Boolean(settings[field as keyof ISystemSettings]);
  }
  // Not a stored field - computed from server-wide env config, so the Settings UI can disable
  // the CAPTCHA toggle with a clear explanation instead of a silent 400 on save.
  masked.captchaConfigured = Boolean(env.TURNSTILE_SECRET_KEY);
  return masked;
}

// SVG intentionally not accepted - see utils/upload.ts's uploadLogo comment (it's the one image
// format that can execute script, and this file is served back publicly/unauthenticated below).
// ".svg" stays in this list so removeExistingLogoFiles() still cleans up a logo an org uploaded
// before this restriction existed, rather than leaving an orphaned file on disk.
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

export const getSettings = asyncHandler(async (req: Request, res: Response) => {
  const settings = await settingsService.getSettings(req.organization!._id);
  ok(res, maskSettings(settings), "System settings");
});

/** Public (unauthenticated) - the branding subset needed to render the login page, sidebar,
 * etc. before login. Mounted behind resolvePublicOrganization, not authenticate. Also carries
 * the org's password policy (for the pre-login reset-password form's live requirements hint)
 * and CAPTCHA config (site key is public/safe to expose - the secret key never leaves the
 * server) - three pre-login consumers, one payload, no extra route. */
export const getBranding = asyncHandler(async (req: Request, res: Response) => {
  const settings = await settingsService.getSettings(req.organization!._id);
  ok(
    res,
    {
      organizationName: req.organization!.name,
      teamName: settings.teamName,
      sidebarColor: settings.sidebarColor,
      appBackgroundColor: settings.appBackgroundColor,
      passwordPolicy: {
        minLength: settings.passwordMinLength,
        requireUppercase: settings.passwordRequireUppercase,
        requireNumber: settings.passwordRequireNumber,
        requireSpecialChar: settings.passwordRequireSpecialChar,
        historyLimit: settings.passwordHistoryLimit,
      },
      captchaEnabled: settings.captchaEnabled && Boolean(env.TURNSTILE_SITE_KEY),
      captchaSiteKey: settings.captchaEnabled ? (env.TURNSTILE_SITE_KEY ?? null) : null,
    },
    "Branding"
  );
});

export const updateSettings = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organization!._id;
  const before = await settingsService.getSettings(organizationId);
  const oldValue = before.toObject();

  // Blank/omitted secret means "leave the stored one unchanged" - never overwrite with "".
  const input: Record<string, unknown> = { ...req.body };
  for (const field of SECRET_FIELDS) {
    if (!input[field]) delete input[field];
  }

  // Defense in depth - the Settings page only offers this checkbox when the org is entitled,
  // but a direct API call shouldn't be able to turn it on for an org the Super Admin hasn't
  // enabled changeWarning for. Mirrors requireModuleEnabled's own message (middleware/authorize.ts).
  if (input.changeWarningEnabled === true && !req.organization!.enabledModules.includes("changeWarning")) {
    throw new ApiError(403, "This module is not enabled for your organization");
  }

  const settings = await settingsService.updateSettings(organizationId, input as Partial<ISystemSettings>);

  const redactedOld = { ...oldValue } as Record<string, unknown>;
  const redactedNew = { ...input } as Record<string, unknown>;
  for (const field of SECRET_FIELDS) {
    redactedOld[field] = undefined;
    redactedNew[field] = input[field] ? "(changed)" : undefined;
  }

  await logAction({
    req,
    action: "UPDATE",
    module: "SystemSettings",
    recordId: settings.id,
    recordLabel: "System settings",
    oldValue: redactedOld,
    newValue: redactedNew,
  });

  ok(res, maskSettings(settings), "System settings updated");
});

export const sendTestAlertEmail = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organization!._id;
  const to = typeof req.body.to === "string" && req.body.to.trim() ? req.body.to.trim() : undefined;
  const settings = await settingsService.getSettings(organizationId);
  const recipients = to ? [to] : settings.alertEmails;

  if (recipients.length === 0) {
    throw new ApiError(400, "No recipient - add an alert email address first or provide one to test.");
  }

  const { subject, html } = await renderTemplate("test", {}, organizationId);

  await sendEmail(
    {
      to: recipients,
      cc: to ? [] : settings.alertEmailsCc,
      bcc: to ? [] : settings.alertEmailsBcc,
      subject,
      html,
    },
    organizationId
  );

  await logAction({ req, action: "UPDATE", module: "SystemSettings", recordLabel: `Test alert email sent to ${recipients.join(", ")}` });

  ok(res, { sentTo: recipients, channel: settings.notificationChannel }, "Test email sent");
});

export const getNotificationTemplates = asyncHandler(async (req: Request, res: Response) => {
  const templates = await listTemplates(req.organization!._id);
  ok(res, templates, "Notification templates");
});

export const updateNotificationTemplate = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organization!._id;
  const key = req.params.key as NotificationTemplateKey;
  if (!NOTIFICATION_TEMPLATE_KEYS.includes(key)) throw new ApiError(404, "Unknown template");

  const template = await NotificationTemplate.findOneAndUpdate(
    { organization: organizationId, key },
    { subject: req.body.subject, bodyHtml: req.body.bodyHtml },
    { new: true, upsert: true }
  );

  await logAction({ req, action: "UPDATE", module: "NotificationTemplate", recordLabel: `Template "${key}" updated` });

  ok(res, template, "Template updated");
});

export const getNotificationLogs = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organization!._id;
  const page = Number(req.query.page) || 1;
  const limit = Math.min(Number(req.query.limit) || 20, 100);

  const filter = { organization: organizationId };
  const [items, total] = await Promise.all([
    NotificationLog.find(filter)
      .sort({ createdDate: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    NotificationLog.countDocuments(filter),
  ]);

  ok(res, { items, total, page, limit, totalPages: Math.ceil(total / limit) }, "Notification logs");
});

export const uploadLogo = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) throw new ApiError(400, "No file uploaded");

  const ext = MIME_TO_EXT[req.file.mimetype];
  if (!ext) throw new ApiError(400, "Unsupported file type");

  const organizationId = req.organization!._id;
  const fileName = `logo-${organizationId}${ext}`;
  removeExistingLogoFiles(organizationId);
  fs.writeFileSync(path.join(BRANDING_DIR, fileName), req.file.buffer);

  const settings = await settingsService.setLogo(organizationId, fileName);

  await logAction({ req, action: "UPDATE", module: "SystemSettings", recordLabel: "Logo updated" });

  ok(res, maskSettings(settings), "Logo updated");
});

export const removeLogo = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organization!._id;
  removeExistingLogoFiles(organizationId);
  const settings = await settingsService.clearLogo(organizationId);

  await logAction({ req, action: "UPDATE", module: "SystemSettings", recordLabel: "Logo removed" });

  ok(res, maskSettings(settings), "Logo removed");
});

/** Public (unauthenticated) so it can be used directly as an <img src> from any page,
 * including login. Mounted behind resolvePublicOrganization, not authenticate. */
export const getLogoImage = asyncHandler(async (req: Request, res: Response) => {
  const settings = await settingsService.getSettings(req.organization!._id);
  if (!settings.logoFileName) throw new ApiError(404, "No logo set");

  const filePath = path.join(BRANDING_DIR, settings.logoFileName);
  if (!fs.existsSync(filePath)) throw new ApiError(404, "No logo set");

  res.setHeader("Cache-Control", "no-store");
  // Helmet's default same-origin CORP would otherwise block the frontend (a different
  // port/origin) from loading this as an <img src>.
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.sendFile(filePath);
});
