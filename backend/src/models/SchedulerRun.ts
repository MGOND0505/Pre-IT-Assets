import { Schema, model } from "mongoose";

/** System-level, cross-org tracking of each background scheduler's most recent run - like
 * PlatformSettings.ts, deliberately carries NO `organization` field. Unlike that model though,
 * this is a small keyed family (one row per scheduler, upserted in place every run) rather than a
 * single true singleton, so "last run" for any given scheduler is always a trivial
 * `findOne({schedulerKey})` instead of scanning an ever-growing log - see
 * services/monitoring/schedulerRun.service.ts for the SCHEDULER_KEYS constants and the
 * upsert/read helpers built on top of this. */
export interface ISchedulerRun {
  schedulerKey: string;
  lastRunAt: Date;
  success: boolean;
  itemCount: number;
  errorMessage: string | null;
}

const schedulerRunSchema = new Schema<ISchedulerRun>(
  {
    schedulerKey: { type: String, required: true, unique: true },
    lastRunAt: { type: Date, required: true },
    success: { type: Boolean, required: true },
    itemCount: { type: Number, required: true, default: 0 },
    errorMessage: { type: String, default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

export const SchedulerRun = model<ISchedulerRun>("SchedulerRun", schedulerRunSchema);
