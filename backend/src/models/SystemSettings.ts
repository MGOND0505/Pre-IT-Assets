import { Schema, model, type Types } from "mongoose";

export type NotificationChannel = "smtp" | "microsoft365" | "google";

export interface ISystemSettings {
  organization: Types.ObjectId;
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
}

const systemSettingsSchema = new Schema<ISystemSettings>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, unique: true },
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
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

export const SystemSettings = model<ISystemSettings>("SystemSettings", systemSettingsSchema);
