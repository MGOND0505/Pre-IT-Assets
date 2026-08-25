import { NotificationTemplate, type NotificationTemplateKey } from "../../models/NotificationTemplate";

export const DEFAULT_TEMPLATES: Record<NotificationTemplateKey, { subject: string; bodyHtml: string }> = {
  expiryDigest: {
    subject: "IT Assets alert - {{count}} item(s) need attention",
    bodyHtml:
      "<p>Daily IT Asset Management alert digest - {{date}}</p>{{warrantySection}}{{amcSection}}{{licenseSection}}",
  },
  assetCreated: {
    subject: "Asset added: {{assetId}}",
    bodyHtml: "<p>A new asset was added: <b>{{assetId}}</b> - {{name}}.</p>",
  },
  assetUpdated: {
    subject: "Asset updated: {{assetId}}",
    bodyHtml: "<p>Asset <b>{{assetId}}</b> - {{name}} was updated:</p><ul>{{changes}}</ul>",
  },
  assetDeleted: {
    subject: "Asset deleted: {{assetId}}",
    bodyHtml: "<p>Asset <b>{{assetId}}</b> - {{name}} was deleted.</p>",
  },
  assetsBulkDeleted: {
    subject: "{{count}} asset(s) deleted",
    bodyHtml: "<p>{{count}} asset(s) were deleted in a bulk action.</p>",
  },
  assetImportBatch: {
    subject: "Asset CSV import completed",
    bodyHtml: "<p>CSV import finished: {{added}} asset(s) added, {{updated}} updated.</p>",
  },
  test: {
    subject: "IT Asset Management - test alert email",
    bodyHtml:
      "<p>This is a test email from IT Asset Management's alert system. If you received this, your notification settings are working.</p>",
  },
  ticketCreated: {
    subject: "New ticket {{ticketId}}: {{subject}}",
    bodyHtml: "<p>A new ticket was created: <b>{{ticketId}}</b> - {{subject}}.</p>",
  },
  ticketAssigned: {
    subject: "Ticket {{ticketId}} assigned to you",
    bodyHtml: "<p>Ticket <b>{{ticketId}}</b> - {{subject}} has been assigned to you.</p>",
  },
  ticketReassigned: {
    subject: "Ticket {{ticketId}} reassigned",
    bodyHtml: "<p>Ticket <b>{{ticketId}}</b> - {{subject}} has been reassigned to you.</p>",
  },
  ticketStatusChanged: {
    subject: "Ticket {{ticketId}} status changed to {{status}}",
    bodyHtml: "<p>Ticket <b>{{ticketId}}</b> - {{subject}} status changed to <b>{{status}}</b>.</p>",
  },
  ticketCommentAdded: {
    subject: "New comment on ticket {{ticketId}}",
    bodyHtml: "<p>A new comment was added to ticket <b>{{ticketId}}</b> - {{subject}}.</p>",
  },
  ticketSlaWarning: {
    subject: "SLA warning: ticket {{ticketId}} nearing breach",
    bodyHtml: "<p>Ticket <b>{{ticketId}}</b> - {{subject}} is approaching its SLA resolution deadline.</p>",
  },
  ticketEscalated: {
    subject: "Ticket {{ticketId}} escalated to {{tier}}",
    bodyHtml: "<p>Ticket <b>{{ticketId}}</b> - {{subject}} breached its SLA and has been escalated to {{tier}}.</p>",
  },
  ticketResolved: {
    subject: "Ticket {{ticketId}} resolved",
    bodyHtml: "<p>Ticket <b>{{ticketId}}</b> - {{subject}} has been marked resolved.</p>",
  },
  ticketClosed: {
    subject: "Ticket {{ticketId}} closed",
    bodyHtml: "<p>Ticket <b>{{ticketId}}</b> - {{subject}} has been closed.</p>",
  },
  taskAssigned: {
    subject: "Task {{taskId}} assigned to you",
    bodyHtml: "<p>Task <b>{{taskId}}</b> - {{title}} has been assigned to you.</p>",
  },
  taskReassigned: {
    subject: "Task {{taskId}} reassigned to you",
    bodyHtml: "<p>Task <b>{{taskId}}</b> - {{title}} has been reassigned to you.</p>",
  },
  taskStatusChanged: {
    subject: "Task {{taskId}} status changed to {{status}}",
    bodyHtml: "<p>Task <b>{{taskId}}</b> - {{title}} status changed to <b>{{status}}</b>.</p>",
  },
  taskOverdue: {
    subject: "Task {{taskId}} is overdue",
    bodyHtml: "<p>Task <b>{{taskId}}</b> - {{title}} is now past its due date.</p>",
  },
};

/** Lazily seeds each template with its default the first time it's read, per organization -
 * admins can then edit any of them from Settings, independently per org. */
export async function getTemplate(key: NotificationTemplateKey, organizationId: string) {
  const existing = await NotificationTemplate.findOne({ organization: organizationId, key });
  if (existing) return existing;
  return NotificationTemplate.create({ organization: organizationId, key, ...DEFAULT_TEMPLATES[key] });
}

export async function listTemplates(organizationId: string) {
  const existingKeys = new Set(
    (await NotificationTemplate.find({ organization: organizationId }).select("key")).map((t) => t.key)
  );
  const missing = Object.keys(DEFAULT_TEMPLATES).filter(
    (k) => !existingKeys.has(k as NotificationTemplateKey)
  ) as NotificationTemplateKey[];
  if (missing.length > 0) {
    await NotificationTemplate.insertMany(
      missing.map((key) => ({ organization: organizationId, key, ...DEFAULT_TEMPLATES[key] }))
    );
  }
  return NotificationTemplate.find({ organization: organizationId }).sort({ key: 1 });
}

function render(text: string, vars: Record<string, string | number>): string {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => (vars[key] !== undefined ? String(vars[key]) : ""));
}

export async function renderTemplate(
  key: NotificationTemplateKey,
  vars: Record<string, string | number>,
  organizationId: string
): Promise<{ subject: string; html: string }> {
  const template = await getTemplate(key, organizationId);
  return { subject: render(template.subject, vars), html: render(template.bodyHtml, vars) };
}
