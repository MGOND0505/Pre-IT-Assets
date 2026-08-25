import { Schema, model, type Types } from "mongoose";
import type { SupportTier } from "./SupportTeam";

export const TICKET_STATUSES = ["New", "Open", "In Progress", "Pending", "Resolved", "Closed", "Reopened"] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

export interface ITicket {
  organization: Types.ObjectId;
  ticketId: string;
  subject: string;
  description: string;
  category: Types.ObjectId | null;
  priority: Types.ObjectId | null;
  requester: Types.ObjectId;
  department: Types.ObjectId | null;
  location: Types.ObjectId | null;
  assignedAgent: Types.ObjectId | null;
  assignedTeam: Types.ObjectId | null;
  tier: SupportTier;
  status: TicketStatus;
  resolution: string;
  firstResponseAt: Date | null;
  resolvedAt: Date | null;
  closedAt: Date | null;
  slaResponseDueAt: Date | null;
  slaResolutionDueAt: Date | null;
  slaResponseBreached: boolean;
  slaResolutionBreached: boolean;
  slaWarningSent: boolean;
  reopenCount: number;
  createdBy: Types.ObjectId | null;
  isDeleted: boolean;
  deletedAt: Date | null;
  deletedBy: Types.ObjectId | null;
}

const ticketSchema = new Schema<ITicket>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    ticketId: { type: String, required: true },
    subject: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    category: { type: Schema.Types.ObjectId, ref: "HelpdeskCategory", default: null },
    priority: { type: Schema.Types.ObjectId, ref: "HelpdeskPriority", default: null },
    requester: { type: Schema.Types.ObjectId, ref: "User", required: true },
    department: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    location: { type: Schema.Types.ObjectId, ref: "Location", default: null },
    assignedAgent: { type: Schema.Types.ObjectId, ref: "User", default: null },
    assignedTeam: { type: Schema.Types.ObjectId, ref: "SupportTeam", default: null },
    tier: { type: String, enum: ["L1", "L2", "L3"], default: "L1" },
    status: { type: String, enum: TICKET_STATUSES, default: "New", index: true },
    resolution: { type: String, default: "" },
    firstResponseAt: { type: Date, default: null },
    resolvedAt: { type: Date, default: null },
    closedAt: { type: Date, default: null },
    slaResponseDueAt: { type: Date, default: null },
    slaResolutionDueAt: { type: Date, default: null, index: true },
    slaResponseBreached: { type: Boolean, default: false },
    slaResolutionBreached: { type: Boolean, default: false },
    slaWarningSent: { type: Boolean, default: false },
    reopenCount: { type: Number, default: 0 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: "updatedDate" } }
);

ticketSchema.index({ organization: 1, ticketId: 1 }, { unique: true });
ticketSchema.index({ organization: 1, requester: 1 });
ticketSchema.index({ organization: 1, assignedAgent: 1 });

export const Ticket = model<ITicket>("Ticket", ticketSchema);
