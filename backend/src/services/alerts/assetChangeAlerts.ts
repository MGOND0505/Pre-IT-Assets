import { getSettings } from "../../modules/settings/settings.service";
import { sendEmail } from "../email";
import { renderTemplate } from "../notifications/templates";
import type { NotificationTemplateKey } from "../../models/NotificationTemplate";
import { logger } from "../../utils/logger";

async function notify(
  organizationId: string,
  key: NotificationTemplateKey,
  vars: Record<string, string | number>
): Promise<void> {
  try {
    const settings = await getSettings(organizationId);
    if (!settings.assetChangeAlertsEnabled) return;
    if (settings.alertEmails.length === 0) return;

    const { subject, html } = await renderTemplate(key, vars, organizationId);
    await sendEmail(
      { to: settings.alertEmails, cc: settings.alertEmailsCc, bcc: settings.alertEmailsBcc, subject, html },
      organizationId
    );
  } catch (err) {
    // A failed alert email must never fail the underlying asset operation.
    logger.error(`Failed to send asset-change alert: ${err instanceof Error ? err.message : err}`);
  }
}

export function notifyAssetCreated(organizationId: string, asset: { assetId: string; name: string }): void {
  void notify(organizationId, "assetCreated", { assetId: asset.assetId, name: asset.name });
}

/** Only fires for changes worth an IT manager's attention - not every minor field edit
 * (e.g. a typo fix in notes doesn't warrant an email). */
const SIGNIFICANT_FIELDS = ["status", "assignedUser", "location", "department", "condition"] as const;

/** assignedUser/location/department come from a doc populated on those refs (see
 * assets.service.ts#POPULATE_FIELDS) - a ref that wasn't reassigned by this update is still a
 * populated sub-document object at this point, not a raw id, so plain String(...) would render as
 * "[object Object]" in the alert email. Show its display name instead when populated. */
function displayValue(value: unknown): string {
  if (!value) return "";
  if (typeof value === "object" && "name" in (value as Record<string, unknown>)) {
    return String((value as { name: unknown }).name ?? "");
  }
  return String(value);
}

export function notifyAssetUpdated(
  organizationId: string,
  asset: { assetId: string; name: string },
  before: Record<string, unknown>,
  after: Record<string, unknown>
): void {
  const changes = SIGNIFICANT_FIELDS.filter((f) => displayValue(before[f]) !== displayValue(after[f]));
  if (changes.length === 0) return;

  const rows = changes
    .map((f) => `<li>${f}: "${displayValue(before[f])}" &rarr; "${displayValue(after[f])}"</li>`)
    .join("");
  void notify(organizationId, "assetUpdated", { assetId: asset.assetId, name: asset.name, changes: rows });
}

export function notifyAssetDeleted(organizationId: string, asset: { assetId: string; name: string }): void {
  void notify(organizationId, "assetDeleted", { assetId: asset.assetId, name: asset.name });
}

export function notifyAssetsBulkDeleted(organizationId: string, count: number): void {
  if (count === 0) return;
  void notify(organizationId, "assetsBulkDeleted", { count });
}

/** One summary email per import batch, not one per row - a 200-row CSV update should not
 * send 200 emails. */
export function notifyAssetImportBatch(organizationId: string, result: { added: number; updated: number }): void {
  if (result.added === 0 && result.updated === 0) return;
  void notify(organizationId, "assetImportBatch", { added: result.added, updated: result.updated });
}
