import type { Document } from "mongoose";
import { Organization } from "../models/Organization";

/** Fallback only - used if an organization lookup somehow comes back empty. Every real
 * Organization document has its own `recycleBinRetentionDays` (schema default 30, configurable
 * 30-180 by a Super Admin or a Sub-Super Admin with a grant for that org). */
export const DEFAULT_RECYCLE_BIN_RETENTION_DAYS = 30;
export const DAY_MS = 24 * 60 * 60 * 1000;

/** Every module's `listX` service calls this once per request with its `organizationId`, then
 * passes the result into `withRecycleBinMeta` - this is what makes the "daysRemaining" a caller
 * sees match the org's own configured policy rather than one flat number for everyone. */
export async function getOrgRetentionDays(organizationId: string): Promise<number> {
  const org = await Organization.findById(organizationId).select("recycleBinRetentionDays");
  return org?.recycleBinRetentionDays ?? DEFAULT_RECYCLE_BIN_RETENTION_DAYS;
}

/** Always computed from `deletedAt` + the org's own retention days, never a separately-stored
 * field - stays correct even if the org's policy is changed after the fact, with zero staleness
 * window. */
export function getRestoreDeadline(deletedAt: Date | null, retentionDays: number): Date | null {
  if (!deletedAt) return null;
  return new Date(deletedAt.getTime() + retentionDays * DAY_MS);
}

/** Whole days left to restore before the automatic purge, clamped to >= 0. Null when the record
 * isn't deleted - the field is meaningless there. */
export function getDaysRemaining(deletedAt: Date | null, retentionDays: number, now = new Date()): number | null {
  const deadline = getRestoreDeadline(deletedAt, retentionDays);
  if (!deadline) return null;
  return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / DAY_MS));
}

type SoftDeletable = Document & { isDeleted: boolean; deletedAt: Date | null };

/** Adds `daysRemaining`/`restoreDeadline` to each item in a Recycle Bin listing response - null
 * for a live (non-deleted) record. `retentionDays` should come from `getOrgRetentionDays` for the
 * organization the items belong to. */
export function withRecycleBinMeta<T extends SoftDeletable>(items: T[], retentionDays: number): Record<string, unknown>[] {
  return items.map((item) => ({
    ...item.toObject(),
    daysRemaining: item.isDeleted ? getDaysRemaining(item.deletedAt, retentionDays) : null,
    restoreDeadline: item.isDeleted ? getRestoreDeadline(item.deletedAt, retentionDays) : null,
  }));
}
