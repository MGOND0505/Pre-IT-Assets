import { Asset } from "../../models/Asset";
import { License } from "../../models/License";
import { Organization } from "../../models/Organization";
import { getSettings } from "../../modules/settings/settings.service";
import { sendEmail } from "../email";
import { renderTemplate } from "../notifications/templates";
import { logger } from "../../utils/logger";

function daysBetween(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function section(title: string, rows: string[]): string {
  if (rows.length === 0) return "";
  return `<h3 style="margin:16px 0 4px">${title} (${rows.length})</h3><ul style="margin:0">${rows
    .map((r) => `<li>${r}</li>`)
    .join("")}</ul>`;
}

/**
 * Daily digest, run once per active organization. Warranty/AMC use a continuous "within N
 * days" window (a single threshold field each), so an item stays on the list every day until
 * resolved. License renewals use the licenseRenewalAlertDays checkpoint array as designed - a
 * license only appears on the exact day(s) it crosses one of those configured markers, not
 * every day in between.
 */
async function runExpiryAlertCheckForOrg(organizationId: string): Promise<number> {
  const settings = await getSettings(organizationId);
  if (!settings.expiryAlertsEnabled) return 0;
  if (settings.alertEmails.length === 0) return 0;

  const now = new Date();

  const warrantyThreshold = new Date(now.getTime() + settings.warrantyAlertDays * 24 * 60 * 60 * 1000);
  const warrantyExpiring = await Asset.find({
    organization: organizationId,
    isDeleted: false,
    warrantyEnd: { $ne: null, $gte: now, $lte: warrantyThreshold },
  })
    .select("assetId name warrantyEnd")
    .sort({ warrantyEnd: 1 })
    .lean();

  const amcThreshold = new Date(now.getTime() + settings.amcAlertDays * 24 * 60 * 60 * 1000);
  const amcExpiring = await Asset.find({
    organization: organizationId,
    isDeleted: false,
    amcEnd: { $ne: null, $gte: now, $lte: amcThreshold },
  })
    .select("assetId name amcEnd")
    .sort({ amcEnd: 1 })
    .lean();

  const activeLicenses = await License.find({
    organization: organizationId,
    isDeleted: false,
    status: "Active",
    expiryDate: { $ne: null, $gte: now },
  })
    .select("licenseId softwareName expiryDate")
    .lean();
  const licenseExpiring = activeLicenses.filter((l) =>
    settings.licenseRenewalAlertDays.includes(daysBetween(now, l.expiryDate as Date))
  );

  const total = warrantyExpiring.length + amcExpiring.length + licenseExpiring.length;
  if (total === 0) return 0;

  const { subject, html } = await renderTemplate(
    "expiryDigest",
    {
      date: formatDate(now),
      count: total,
      warrantySection: section(
        "Warranties expiring",
        warrantyExpiring.map((a) => `${a.assetId} - ${a.name} (ends ${formatDate(a.warrantyEnd as Date)})`)
      ),
      amcSection: section(
        "AMC contracts expiring",
        amcExpiring.map((a) => `${a.assetId} - ${a.name} (ends ${formatDate(a.amcEnd as Date)})`)
      ),
      licenseSection: section(
        "Licenses due for renewal",
        licenseExpiring.map((l) => `${l.licenseId} - ${l.softwareName} (expires ${formatDate(l.expiryDate as Date)})`)
      ),
    },
    organizationId
  );

  await sendEmail(
    {
      to: settings.alertEmails,
      cc: settings.alertEmailsCc,
      bcc: settings.alertEmailsBcc,
      subject,
      html,
    },
    organizationId
  );

  logger.info(`Expiry alert digest (${total} item(s)) sent to ${settings.alertEmails.join(", ")} for org ${organizationId}`);
  return total;
}

/** Returns the total number of expiry-alert items sent across every active organization (sum of
 * each org's warranty/AMC/license digest item count), used by the scheduler to record its last-run
 * outcome (see services/monitoring/schedulerRun.service.ts). */
export async function runExpiryAlertCheck(): Promise<number> {
  const organizations = await Organization.find({ status: "Active", isDeleted: false }).select("_id");
  let total = 0;
  for (const org of organizations) {
    try {
      total += await runExpiryAlertCheckForOrg(String(org._id));
    } catch (err) {
      logger.error(`Expiry alert check failed for org ${org._id}: ${err instanceof Error ? err.message : err}`);
    }
  }
  return total;
}
