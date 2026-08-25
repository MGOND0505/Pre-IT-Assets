import type { EmailProvider, EmailMessage } from "./EmailProvider";
import { ConsoleEmailProvider } from "./ConsoleEmailProvider";
import { SmtpEmailProvider } from "./SmtpEmailProvider";
import { Microsoft365Provider } from "./Microsoft365Provider";
import { GoogleWorkspaceProvider } from "./GoogleWorkspaceProvider";
import { getSettings } from "../../modules/settings/settings.service";
import { logNotification } from "../notifications/logNotification";
import { logger } from "../../utils/logger";
import type { ISystemSettings } from "../../models/SystemSettings";

const consoleProvider = new ConsoleEmailProvider();

/** Picks the provider for the admin's selected channel, but only once it's actually fully
 * configured - falls back to logging (never throws) so a half-set-up channel never blocks
 * whatever triggered the notification. Read fresh from the DB on every send so config
 * changes apply immediately, no restart needed. */
function resolveProvider(settings: ISystemSettings): { provider: EmailProvider; channel: string } {
  switch (settings.notificationChannel) {
    case "microsoft365":
      if (settings.m365TenantId && settings.m365ClientId && settings.m365ClientSecret && settings.m365SenderEmail) {
        return { provider: new Microsoft365Provider(settings), channel: "microsoft365" };
      }
      break;
    case "google":
      if (settings.googleServiceAccountEmail && settings.googleServiceAccountPrivateKey && settings.googleSenderEmail) {
        return { provider: new GoogleWorkspaceProvider(settings), channel: "google" };
      }
      break;
    case "smtp":
    default:
      if (settings.smtpHost && settings.smtpFromEmail) {
        return { provider: new SmtpEmailProvider(settings), channel: "smtp" };
      }
  }
  return { provider: consoleProvider, channel: "console" };
}

export const emailProvider = {
  /** organizationId is null only for a system-level (superAdmin) account, which has no
   * per-org mail configuration to read - those sends just go to the console, unlogged
   * (there's no organization to attribute a NotificationLog entry to). */
  async send(message: EmailMessage, organizationId: string | null) {
    if (!organizationId) {
      await consoleProvider.send(message);
      logger.info(`Email (no organization context) logged to console: ${message.subject}`);
      return;
    }

    const settings = await getSettings(organizationId);
    const { provider, channel } = resolveProvider(settings);

    try {
      await provider.send(message);
      await logNotification({ organizationId, channel, message, status: "sent" });
    } catch (err) {
      await logNotification({
        organizationId,
        channel,
        message,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  },
};

export const sendEmail = (message: EmailMessage, organizationId: string | null) =>
  emailProvider.send(message, organizationId);
