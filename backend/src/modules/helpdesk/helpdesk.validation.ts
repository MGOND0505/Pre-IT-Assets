import { z } from "zod";
import { TICKET_STATUSES } from "../../models/Ticket";

export const dashboardSummaryQuerySchema = z.object({
  days: z.coerce.number().int().refine((v) => [7, 14, 30].includes(v), "days must be 7, 14, or 30").optional(),
});

export const createTicketSchema = z.object({
  subject: z.string().min(1).max(200),
  description: z.string().max(10_000).optional().default(""),
  category: z.string().optional(),
  priority: z.string().min(1),
  department: z.string().optional(),
  location: z.string().optional(),
  // Real per-field validation (required-ness, type, select options) happens server-side in
  // validateCustomFieldValues, not here - this just needs to not strip or reject the field.
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const updateTicketSchema = z.object({
  subject: z.string().min(1).max(200).optional(),
  description: z.string().max(10_000).optional(),
  category: z.string().optional(),
  priority: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
  customFields: z.record(z.string(), z.unknown()).optional(),
});

export const setTicketStatusSchema = z.object({
  status: z.enum(TICKET_STATUSES),
  resolution: z.string().optional(),
});

export const assignTicketSchema = z.object({
  agentId: z.string().min(1),
});

export const listTicketsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().max(100).optional(),
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.string().optional(),
  category: z.string().optional(),
  assignedAgent: z.string().optional(),
});

export const ticketIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const addCommentSchema = z.object({
  body: z.string().min(1),
  isInternal: z.coerce.boolean().optional().default(false),
});
