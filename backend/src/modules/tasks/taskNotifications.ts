import { User } from "../../models/User";
import { Notification } from "../../models/Notification";
import { sendEmail } from "../../services/email";
import { renderTemplate } from "../../services/notifications/templates";
import { logger } from "../../utils/logger";
import type { NotificationTemplateKey } from "../../models/NotificationTemplate";

/** Fire-and-forget, mirrors helpdesk/helpdeskNotifications.ts exactly - a notification failure
 * must never fail the task action that triggered it. Also creates the matching in-app "My
 * Notifications" entry - see that file's own comment for why this lives at the same call site as
 * the email. Links to the tasks list, not a per-task detail page - unlike tickets, there is no
 * /tasks/[id] route in this app (tasks are managed entirely from the list view). */
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
    await Notification.create({
      organization: organizationId,
      user: recipientUserId,
      type: key,
      title: subject,
      link: "/tasks",
    });
    await sendEmail({ to: recipient.email, subject, html }, organizationId);
  } catch (err) {
    logger.error(`Task notification "${key}" failed: ${err instanceof Error ? err.message : err}`);
  }
}
