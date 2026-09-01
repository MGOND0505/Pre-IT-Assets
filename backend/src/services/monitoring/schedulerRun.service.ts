import { SchedulerRun } from "../../models/SchedulerRun";

/** The single shared source of truth for each scheduler's `schedulerKey` string literal - the 5
 * scheduler files' cron callbacks and the System Monitoring read side (systemStatus module) both
 * import from here, so the keys can never drift apart via a hand-typed mismatch. */
export const SCHEDULER_KEYS = {
  expiryAlerts: "expiryAlerts",
  organizationExpiry: "organizationExpiry",
  recycleBinPurge: "recycleBinPurge",
  dataRetention: "dataRetention",
  helpdeskEscalation: "helpdeskEscalation",
} as const;

export type SchedulerKey = (typeof SCHEDULER_KEYS)[keyof typeof SCHEDULER_KEYS];

/** Upserts the one row for a given scheduler with its most recent run outcome - called from both
 * the success and failure paths of each of the 5 schedulers' cron callbacks. Never throws into the
 * caller's own error handling; callers still wrap this call with its own `.catch(() => {})` on the
 * failure path since this itself can fail (e.g. a transient DB hiccup). */
export async function recordSchedulerRun(
  schedulerKey: SchedulerKey,
  result: { success: boolean; itemCount: number; errorMessage: string | null }
): Promise<void> {
  await SchedulerRun.findOneAndUpdate(
    { schedulerKey },
    { schedulerKey, lastRunAt: new Date(), ...result },
    { upsert: true }
  );
}

/** Every scheduler's last-run row, for the System Monitoring page - fewer than 5 rows is expected
 * and fine (a scheduler that hasn't fired since the last server restart just has no row yet; the
 * frontend shows "Not yet run" for a missing key). */
export async function listSchedulerRuns() {
  return SchedulerRun.find({}).lean();
}
