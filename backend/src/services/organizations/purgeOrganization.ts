import fs from "node:fs";
import path from "node:path";
import { Organization } from "../../models/Organization";
import { User } from "../../models/User";
import { Asset } from "../../models/Asset";
import { AssetDocument } from "../../models/AssetDocument";
import { AssetHistory } from "../../models/AssetHistory";
import { AssetCategory } from "../../models/AssetCategory";
import { License } from "../../models/License";
import { LicenseCategory } from "../../models/LicenseCategory";
import { Vendor } from "../../models/Vendor";
import { Department } from "../../models/Department";
import { Location } from "../../models/Location";
import { HelpdeskCategory } from "../../models/HelpdeskCategory";
import { HelpdeskPriority } from "../../models/HelpdeskPriority";
import { SupportTeam } from "../../models/SupportTeam";
import { Ticket } from "../../models/Ticket";
import { TicketComment } from "../../models/TicketComment";
import { Task } from "../../models/Task";
import { LoginHistory } from "../../models/LoginHistory";
import { NotificationTemplate } from "../../models/NotificationTemplate";
import { NotificationLog } from "../../models/NotificationLog";
import { SystemSettings } from "../../models/SystemSettings";
import { AccessRequest } from "../../models/AccessRequest";
import { AuditLog } from "../../models/AuditLog";
import { ApiError } from "../../utils/ApiError";
import { ASSET_DOCUMENTS_DIR, TICKET_ATTACHMENTS_DIR, BRANDING_DIR } from "../../utils/upload";
import { logger } from "../../utils/logger";

const LOGO_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp", ".svg"];

function tryUnlink(filePath: string) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch (err) {
    logger.warn(`Could not remove file during organization purge: ${filePath} - ${err instanceof Error ? err.message : err}`);
  }
}

/**
 * Irreversibly deletes an organization and every record scoped to it - the terminal step of the
 * Recycle Bin lifecycle (soft-delete -> up to 90 days restorable -> this). Only ever called on an
 * organization already soft-deleted (either by the nightly retention sweep, see
 * recycleBinScheduler.ts, or - if ever added later - a manual "empty now" action), never as a
 * direct replacement for `deleteOrganization`.
 *
 * Deliberately deletes AuditLog entries LAST - deleting them first would erase the trail we're
 * about to append a PURGE entry to, and the audit log is meant to outlive the org it describes
 * either way (`AuditLog.organization` staying a reference to a now-nonexistent org is expected,
 * not a bug - the same way a paper trail outlives what it documents).
 */
export async function purgeOrganization(organizationId: string, actorName = "System"): Promise<void> {
  const org = await Organization.findOne({ _id: organizationId, isDeleted: true });
  if (!org) throw new ApiError(404, "Deleted organization not found");

  const orgFilter = { organization: organizationId };

  // Collect file references before their owning DB rows are deleted.
  const assetIds = (await Asset.find(orgFilter).select("_id")).map((a) => a._id);
  const assetDocs = await AssetDocument.find({ asset: { $in: assetIds } }).select("storedFileName");
  const ticketComments = await TicketComment.find(orgFilter).select("attachments");

  await Promise.all([
    AssetDocument.deleteMany({ asset: { $in: assetIds } }),
    AssetHistory.deleteMany({ asset: { $in: assetIds } }),
    Asset.deleteMany(orgFilter),
    AssetCategory.deleteMany(orgFilter),
    License.deleteMany(orgFilter),
    LicenseCategory.deleteMany(orgFilter),
    Vendor.deleteMany(orgFilter),
    Department.deleteMany(orgFilter),
    Location.deleteMany(orgFilter),
    HelpdeskCategory.deleteMany(orgFilter),
    HelpdeskPriority.deleteMany(orgFilter),
    SupportTeam.deleteMany(orgFilter),
    TicketComment.deleteMany(orgFilter),
    Ticket.deleteMany(orgFilter),
    Task.deleteMany(orgFilter),
    LoginHistory.deleteMany(orgFilter),
    NotificationTemplate.deleteMany(orgFilter),
    NotificationLog.deleteMany(orgFilter),
    SystemSettings.deleteMany(orgFilter),
    AccessRequest.deleteMany(orgFilter),
    User.deleteMany(orgFilter),
  ]);

  // A Sub-Super Admin's grant for this org is now a dangling reference - drop it rather than
  // leave it to surface as a null entry wherever orgAccess.organization gets populated.
  await User.updateMany({ role: "subSuperAdmin" }, { $pull: { orgAccess: { organization: organizationId } } });

  for (const doc of assetDocs) tryUnlink(path.join(ASSET_DOCUMENTS_DIR, doc.storedFileName));
  for (const comment of ticketComments) {
    for (const attachment of comment.attachments) tryUnlink(path.join(TICKET_ATTACHMENTS_DIR, attachment.storedName));
  }
  for (const ext of LOGO_EXTENSIONS) tryUnlink(path.join(BRANDING_DIR, `logo-${organizationId}${ext}`));

  const { name, slug } = org;
  await org.deleteOne();

  await AuditLog.create({
    organization: organizationId,
    user: null,
    userSnapshot: { name: actorName, email: null, role: null },
    action: "PURGE",
    module: "Organization",
    recordId: organizationId,
    recordLabel: name,
    newValue: { slug },
  });

  logger.info(`Organization "${name}" (${slug}) permanently deleted - all associated data removed`);
}
