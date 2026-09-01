import cron from "node-cron";
import fs from "node:fs/promises";
import path from "node:path";
import type { HydratedDocument, Model, Types } from "mongoose";
import { Organization } from "../../models/Organization";
import { Vendor } from "../../models/Vendor";
import { Department } from "../../models/Department";
import { Location } from "../../models/Location";
import { HelpdeskCategory } from "../../models/HelpdeskCategory";
import { HelpdeskPriority } from "../../models/HelpdeskPriority";
import { User } from "../../models/User";
import { Ticket } from "../../models/Ticket";
import { TicketComment } from "../../models/TicketComment";
import { Task } from "../../models/Task";
import { License } from "../../models/License";
import { Asset } from "../../models/Asset";
import { AssetDocument } from "../../models/AssetDocument";
import { AssetHistory } from "../../models/AssetHistory";
import { AuditLog } from "../../models/AuditLog";
import { ASSET_DOCUMENTS_DIR, TICKET_ATTACHMENTS_DIR } from "../../utils/upload";
import { DAY_MS } from "../../utils/recycleBin";
import { logger } from "../../utils/logger";

async function logPurge(organization: unknown, moduleName: string, recordId: unknown, recordLabel: string | null) {
  await AuditLog.create({
    organization,
    user: null,
    userSnapshot: { name: "System", email: null, role: null },
    action: "PURGE",
    module: moduleName,
    recordId,
    recordLabel,
  });
}

async function tryUnlink(filePath: string) {
  await fs.unlink(filePath).catch(() => {
    /* already gone - fine */
  });
}

type SoftDeletable = { organization: unknown; deletedAt: Date | null; isDeleted: boolean };

/** Finds every record of one model, scoped to one organization, past THAT organization's own
 * configured Recycle Bin retention window and permanently deletes it, logging a PURGE audit
 * entry per record. For models with no dependent data (Vendor, Department, Location,
 * HelpdeskCategory, HelpdeskPriority, User, Task, License) - Ticket and Asset have
 * their own cascade-aware purge below. */
async function purgeSimple<T extends SoftDeletable>(
  model: Model<T>,
  moduleName: string,
  organizationId: Types.ObjectId,
  cutoff: Date,
  getLabel: (doc: HydratedDocument<T>) => string | null
): Promise<number> {
  const expired = await model.find({ organization: organizationId, isDeleted: true, deletedAt: { $ne: null, $lte: cutoff } });
  for (const doc of expired) {
    const organization = doc.organization;
    const recordId = doc._id;
    const label = getLabel(doc);
    await doc.deleteOne();
    await logPurge(organization, moduleName, recordId, label);
  }
  return expired.length;
}

async function purgeExpiredTickets(organizationId: Types.ObjectId, cutoff: Date): Promise<number> {
  const expired = await Ticket.find({ organization: organizationId, isDeleted: true, deletedAt: { $ne: null, $lte: cutoff } });
  for (const ticket of expired) {
    const comments = await TicketComment.find({ ticket: ticket._id }).select("attachments");
    for (const comment of comments) {
      for (const attachment of comment.attachments) {
        await tryUnlink(path.join(TICKET_ATTACHMENTS_DIR, attachment.storedName));
      }
    }
    await TicketComment.deleteMany({ ticket: ticket._id });

    const organization = ticket.organization;
    const recordId = ticket._id;
    const label = ticket.subject;
    await ticket.deleteOne();
    await logPurge(organization, "Ticket", recordId, label);
  }
  return expired.length;
}

async function purgeExpiredAssets(organizationId: Types.ObjectId, cutoff: Date): Promise<number> {
  const expired = await Asset.find({ organization: organizationId, isDeleted: true, deletedAt: { $ne: null, $lte: cutoff } });
  for (const asset of expired) {
    const documents = await AssetDocument.find({ asset: asset._id }).select("storedFileName");
    for (const doc of documents) {
      await tryUnlink(path.join(ASSET_DOCUMENTS_DIR, doc.storedFileName));
    }
    await AssetDocument.deleteMany({ asset: asset._id });
    await AssetHistory.deleteMany({ asset: asset._id });

    const organization = asset.organization;
    const recordId = asset._id;
    const label = asset.name;
    await asset.deleteOne();
    await logPurge(organization, "Asset", recordId, label);
  }
  return expired.length;
}

/** Finds every soft-deleted record across every recycle-bin-enabled module whose retention
 * window has elapsed and permanently deletes it, cascading to dependent data (Ticket
 * comments/attachments, Asset documents/history/attachments) where relevant. The window is each
 * organization's own configured `recycleBinRetentionDays` (30-180, defaults to 30), not a single
 * global constant - so this sweeps organization by organization, each with its own cutoff, rather
 * than one flat cutoff across every record. Each organization (and each model within it) is swept
 * independently so one failure doesn't block the rest. */
export async function sweepExpiredDeletedData(): Promise<void> {
  const organizations = await Organization.find({ isDeleted: false }).select("_id recycleBinRetentionDays");

  let total = 0;
  for (const org of organizations) {
    const cutoff = new Date(Date.now() - org.recycleBinRetentionDays * DAY_MS);
    const results = await Promise.allSettled([
      purgeSimple(Vendor, "Vendor", org._id, cutoff, (d) => d.name),
      purgeSimple(Department, "Department", org._id, cutoff, (d) => d.name),
      purgeSimple(Location, "Location", org._id, cutoff, (d) => d.name),
      purgeSimple(HelpdeskCategory, "HelpdeskCategory", org._id, cutoff, (d) => d.name),
      purgeSimple(HelpdeskPriority, "HelpdeskPriority", org._id, cutoff, (d) => d.name),
      purgeSimple(User, "User", org._id, cutoff, (d) => d.email),
      purgeSimple(Task, "Task", org._id, cutoff, (d) => d.title),
      purgeSimple(License, "License", org._id, cutoff, (d) => d.softwareName),
      purgeExpiredTickets(org._id, cutoff),
      purgeExpiredAssets(org._id, cutoff),
    ]);

    for (const result of results) {
      if (result.status === "fulfilled") {
        total += result.value;
      } else {
        logger.error(`Recycle Bin data retention sweep failed for organization ${org._id}: ${result.reason}`);
      }
    }
  }

  if (total > 0) {
    logger.info(`Recycle Bin data retention sweep: permanently deleted ${total} record(s) past their retention window`);
  }
}

/** Runs once a day at 09:00 server time - offset from the Organization-level 08:00/08:30 jobs
 * so all the daily sweeps don't hit the DB in the same instant. */
export function startDataRetentionScheduler(): void {
  cron.schedule("0 9 * * *", () => {
    sweepExpiredDeletedData().catch((err) => {
      logger.error(`Recycle Bin data retention sweep failed: ${err instanceof Error ? err.message : err}`);
    });
  });
  logger.info("Recycle Bin data retention scheduler started (daily at 09:00)");
}
