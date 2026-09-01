import { Schema, model, type Types } from "mongoose";
import type { PermissionsShape } from "../config/permissions";

export type NotificationChannel = "smtp" | "microsoft365" | "google";

export interface ISystemSettings {
  organization: Types.ObjectId;
  // Null = not configured yet - see settings.service.ts#getDefaultEmployeePermissions, the one
  // place that falls back to config/permissions.ts#basicUserDefaultPermissions() when this is null.
  defaultEmployeePermissions: PermissionsShape | null;
  assetIdCompanyPrefix: string;
  warrantyAlertDays: number;
  amcAlertDays: number;
  licenseRenewalAlertDays: number[];
  licenseIdPrefix: string;
  licenseNextSequence: number;
  helpdeskIdPrefix: string;
  helpdeskNextSequence: number;
  taskIdPrefix: string;
  taskNextSequence: number;
  logoFileName: string;
  teamName: string;
  sidebarColor: string;
  appBackgroundColor: string;
  alertEmails: string[];
  alertEmailsCc: string[];
  alertEmailsBcc: string[];
  expiryAlertsEnabled: boolean;
  assetChangeAlertsEnabled: boolean;
  notificationChannel: NotificationChannel;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpSecure: boolean;
  smtpFromEmail: string;
  smtpFromName: string;
  m365TenantId: string;
  m365ClientId: string;
  m365ClientSecret: string;
  m365SenderEmail: string;
  googleServiceAccountEmail: string;
  googleServiceAccountPrivateKey: string;
  googleSenderEmail: string;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  passwordRequireSpecialChar: boolean;
  passwordHistoryLimit: number;
  passwordExpiryDays: number;
  passwordExpiryWarningDays: number;
  captchaEnabled: boolean;
  // 0 = disabled (never expire from inactivity - just the fixed JWT_EXPIRES_IN lifetime).
  // Enforced by middleware/authenticate.ts against the token's own sliding `lastActivity` claim.
  idleTimeoutMinutes: number;
}

const systemSettingsSchema = new Schema<ISystemSettings>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, unique: true },
    defaultEmployeePermissions: { type: Schema.Types.Mixed, default: null },
    assetIdCompanyPrefix: { type: String, default: "VNR", trim: true, uppercase: true },
    warrantyAlertDays: { type: Number, default: 30 },
    amcAlertDays: { type: Number, default: 30 },
    licenseRenewalAlertDays: { type: [Number], default: [90, 60, 30, 15, 7] },
    licenseIdPrefix: { type: String, default: "LIC", trim: true, uppercase: true },
    licenseNextSequence: { type: Number, default: 1 },
    helpdeskIdPrefix: { type: String, default: "TCK", trim: true, uppercase: true },
    helpdeskNextSequence: { type: Number, default: 1 },
    taskIdPrefix: { type: String, default: "TSK", trim: true, uppercase: true },
    taskNextSequence: { type: Number, default: 1 },
    logoFileName: { type: String, default: "" },
    teamName: { type: String, default: "", trim: true },
    sidebarColor: { type: String, default: "", trim: true },
    appBackgroundColor: { type: String, default: "", trim: true },
    alertEmails: { type: [String], default: [] },
    alertEmailsCc: { type: [String], default: [] },
    alertEmailsBcc: { type: [String], default: [] },
    expiryAlertsEnabled: { type: Boolean, default: false },
    assetChangeAlertsEnabled: { type: Boolean, default: false },
    notificationChannel: { type: String, enum: ["smtp", "microsoft365", "google"], default: "smtp" },
    smtpHost: { type: String, default: "", trim: true },
    smtpPort: { type: Number, default: 587 },
    smtpUser: { type: String, default: "", trim: true },
    smtpPassword: { type: String, default: "" },
    smtpSecure: { type: Boolean, default: false },
    smtpFromEmail: { type: String, default: "", trim: true },
    smtpFromName: { type: String, default: "", trim: true },
    m365TenantId: { type: String, default: "", trim: true },
    m365ClientId: { type: String, default: "", trim: true },
    m365ClientSecret: { type: String, default: "" },
    m365SenderEmail: { type: String, default: "", trim: true },
    googleServiceAccountEmail: { type: String, default: "", trim: true },
    googleServiceAccountPrivateKey: { type: String, default: "" },
    googleSenderEmail: { type: String, default: "", trim: true },
    passwordMinLength: { type: Number, default: 8, min: 8, max: 64 },
    passwordRequireUppercase: { type: Boolean, default: true },
    passwordRequireNumber: { type: Boolean, default: true },
    passwordRequireSpecialChar: { type: Boolean, default: true },
    passwordHistoryLimit: { type: Number, default: 2, min: 0, max: 10 },
    passwordExpiryDays: { type: Number, default: 0, min: 0, max: 180 },
    passwordExpiryWarningDays: { type: Number, default: 14, min: 0, max: 180 },
    captchaEnabled: { type: Boolean, default: false },
    idleTimeoutMinutes: { type: Number, default: 30, min: 0, max: 1440 },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

export const SystemSettings = model<ISystemSettings>("SystemSettings", systemSettingsSchema);
