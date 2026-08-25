import { z } from "zod";

export const updateSettingsSchema = z.object({
  assetIdCompanyPrefix: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/)
    .optional(),
  warrantyAlertDays: z.coerce.number().int().positive().optional(),
  amcAlertDays: z.coerce.number().int().positive().optional(),
  licenseRenewalAlertDays: z.array(z.coerce.number().int().positive()).min(1).optional(),
  licenseIdPrefix: z
    .string()
    .min(2)
    .max(10)
    .regex(/^[A-Za-z0-9]+$/)
    .optional(),
  teamName: z.string().max(80).optional(),
  sidebarColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .or(z.literal("")),
  appBackgroundColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional()
    .or(z.literal("")),
  alertEmails: z.array(z.string().trim().email()).max(20).optional(),
  alertEmailsCc: z.array(z.string().trim().email()).max(20).optional(),
  alertEmailsBcc: z.array(z.string().trim().email()).max(20).optional(),
  expiryAlertsEnabled: z.boolean().optional(),
  assetChangeAlertsEnabled: z.boolean().optional(),
  notificationChannel: z.enum(["smtp", "microsoft365", "google"]).optional(),
  smtpHost: z.string().trim().max(200).optional().or(z.literal("")),
  smtpPort: z.coerce.number().int().min(1).max(65535).optional(),
  smtpUser: z.string().trim().max(200).optional().or(z.literal("")),
  smtpPassword: z.string().max(500).optional(),
  smtpSecure: z.boolean().optional(),
  smtpFromEmail: z.string().trim().email().optional().or(z.literal("")),
  smtpFromName: z.string().trim().max(100).optional().or(z.literal("")),
  m365TenantId: z.string().trim().max(200).optional().or(z.literal("")),
  m365ClientId: z.string().trim().max(200).optional().or(z.literal("")),
  m365ClientSecret: z.string().max(1000).optional(),
  m365SenderEmail: z.string().trim().email().optional().or(z.literal("")),
  googleServiceAccountEmail: z.string().trim().email().optional().or(z.literal("")),
  googleServiceAccountPrivateKey: z.string().max(10000).optional(),
  googleSenderEmail: z.string().trim().email().optional().or(z.literal("")),
});

export const updateTemplateSchema = z.object({
  subject: z.string().min(1).max(300),
  bodyHtml: z.string().min(1).max(20000),
});
