import { Schema, model, type Types } from "mongoose";

export const TASK_PRIORITIES = ["Low", "Medium", "High", "Urgent"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

export const TASK_STATUSES = ["To Do", "In Progress", "Done", "Cancelled"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export interface ITask {
  organization: Types.ObjectId;
  taskId: string;
  title: string;
  description: string;
  assignedTo: Types.ObjectId;
  assignedBy: Types.ObjectId | null;
  dueDate: Date | null;
  priority: TaskPriority;
  status: TaskStatus;
  // Null for a standalone task; set when this task is a sub-task of a Helpdesk ticket - the
  // SAME record/service powers both surfaces, see modules/tasks/tasks.service.ts.
  ticket: Types.ObjectId | null;
  completedAt: Date | null;
  overdueNoticeSent: boolean;
  createdBy: Types.ObjectId | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}

const taskSchema = new Schema<ITask>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    taskId: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    assignedTo: { type: Schema.Types.ObjectId, ref: "User", required: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    dueDate: { type: Date, default: null, index: true },
    priority: { type: String, enum: TASK_PRIORITIES, default: "Medium" },
    status: { type: String, enum: TASK_STATUSES, default: "To Do", index: true },
    ticket: { type: Schema.Types.ObjectId, ref: "Ticket", default: null, index: true },
    completedAt: { type: Date, default: null },
    overdueNoticeSent: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

taskSchema.index({ organization: 1, taskId: 1 }, { unique: true });
taskSchema.index({ organization: 1, assignedTo: 1 });

export const Task = model<ITask>("Task", taskSchema);
