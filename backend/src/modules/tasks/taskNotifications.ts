import { User } from "../../models/User";
import { sendEmail } from "../../services/email";
import { renderTemplate } from "../../services/notifications/templates";
import { logger } from "../../utils/logger";
import type { NotificationTemplateKey } from "../../models/NotificationTemplate";

/** Fire-and-forget, mirrors helpdesk/helpdeskNotifications.ts exactly - a notification failure
 * must never fail the task action that triggered it. */
export async function notifyTaskEvent(
  key: NotificationTemplateKey,
  recipientUserId: string | null,
  organizationId: string,
  vars: Record<string, string | number>
): Promise<void> {
  if (!recipientUserId) return;
  try {
    const recipient = await User.findById(recipientUserId).select("email status");
    if (!recipient || recipient.status !== "Active" || !recipient.email) return;

    const { subject, html } = await renderTemplate(key, vars, organizationId);
    await sendEmail({ to: recipient.email, subject, html }, organizationId);
  } catch (err) {
    logger.error(`Task notification "${key}" failed: ${err instanceof Error ? err.message : err}`);
  }
}
