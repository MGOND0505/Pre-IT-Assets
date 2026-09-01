import { User } from "../../models/User";
import { Notification } from "../../models/Notification";
import { sendEmail } from "../../services/email";
import { renderTemplate } from "../../services/notifications/templates";
import { logger } from "../../utils/logger";
import type { NotificationTemplateKey } from "../../models/NotificationTemplate";

/** Pulls a raw id back out of a ref that may or may not be populated - `String()` on a populated
 * Mongoose subdocument does NOT give back a clean id string, so every caller that might be
 * holding a populated ticket (which is the common case, since getTicketById/list queries always
 * populate) needs this instead of stringifying the ref directly. */
export function idOf(ref: unknown): string | null {
  if (!ref) return null;
  if (typeof ref === "string") return ref;
  return String((ref as { _id: unknown })._id ?? ref);
}

/**
 * Fire-and-forget: a notification failure must never fail (or roll back) the ticket action that
 * triggered it, exactly like the existing expiry-alert emails already behave. Resolves the
 * recipient's email fresh each time rather than trusting a possibly-stale populated field.
 *
 * Also creates the matching in-app "My Notifications" entry (see models/Notification.ts) - one
 * call site for both channels so they can never drift on "who gets notified about what". Pass
 * `ticketId` (the ticket's own Mongo _id, not the human-readable `TCK-000123` string already in
 * `vars`) so the in-app entry can link straight to it; omitted only for event types with no single
 * ticket to link to.
 */
export async function notifyTicketEvent(
  key: NotificationTemplateKey,
  recipientUserId: string | null,
  organizationId: string,
  vars: Record<string, string | number>,
  ticketId?: string
): Promise<void> {
  if (!recipientUserId) return;
  try {
    const recipient = await User.findById(recipientUserId).select("email status");
    if (!recipient || recipient.status !== "Active" || !recipient.email) {
      logger.warn(`Ticket notification "${key}" skipped - recipient ${recipientUserId} is missing or inactive`);
      return;
    }

    const { subject, html } = await renderTemplate(key, vars, organizationId);
    // In-app first - an SMTP failure below must not prevent the user seeing this in their
    // notification feed, the two channels are independent from here on.
    await Notification.create({
      organization: organizationId,
      user: recipientUserId,
      type: key,
      title: subject,
      link: ticketId ? `/helpdesk/${ticketId}` : null,
    });
    await sendEmail({ to: recipient.email, subject, html }, organizationId);
  } catch (err) {
    logger.error(`Ticket notification "${key}" failed: ${err instanceof Error ? err.message : err}`);
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Reads a populated ref's `.name` without fighting the schema's `ObjectId | null` typing -
 * mirrors helpdesk.controller.ts's `idOf(ref: unknown)` for the same reason: Mongoose gives us a
 * real populated subdocument at runtime, but the model only ever declares the unpopulated type. */
export function nameOf(ref: unknown, fallback = "-"): string {
  if (!ref || typeof ref !== "object") return fallback;
  const name = (ref as { name?: unknown }).name;
  return typeof name === "string" && name ? escapeHtml(name) : fallback;
}

type AssignmentVarsExtra = { assignedBy: string; previousAgent?: string; tier?: string };

/** Builds the common var set every assignment-related email shares - ticket must already be
 * populated (category/priority/requester/assignedAgent), matching what
 * helpdesk.service.ts's getTicketById/POPULATE_FIELDS and escalationScheduler.ts's populated
 * query both already provide. `assignedBy` has no valid "leave blank" case (every caller names
 * either the acting user or a descriptive system label), so it's required, not optional. */
export function buildAssignmentVars(
  ticket: { ticketId: string; subject: string; category?: unknown; priority?: unknown; requester?: unknown; assignedAgent?: unknown },
  extra: AssignmentVarsExtra
): Record<string, string> {
  const requester = ticket.requester as { name?: string; email?: string } | null | undefined;
  return {
    ticketId: ticket.ticketId,
    subject: escapeHtml(ticket.subject),
    priority: nameOf(ticket.priority),
    category: nameOf(ticket.category),
    requester: requester?.name ? escapeHtml(requester.name) : "-",
    requesterEmail: requester?.email ? escapeHtml(requester.email) : "-",
    assignedAgent: nameOf(ticket.assignedAgent),
    assignedBy: escapeHtml(extra.assignedBy),
    previousAgent: extra.previousAgent ?? "-",
    ...(extra.tier ? { tier: extra.tier } : {}),
  };
}
