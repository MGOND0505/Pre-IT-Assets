import { z } from "zod";
import { TICKET_STATUSES } from "../../models/Ticket";

export const dashboardSummaryQuerySchema = z.object({
  days: z.coerce.number().int().refine((v) => [7, 14, 30].includes(v), "days must be 7, 14, or 30").optional(),
});

export const createTicketSchema = z.object({
  subject: z.string().min(1),
  description: z.string().optional().default(""),
  category: z.string().optional(),
  priority: z.string().min(1),
  department: z.string().optional(),
  location: z.string().optional(),
});

export const updateTicketSchema = z.object({
  subject: z.string().min(1).optional(),
  description: z.string().optional(),
  category: z.string().optional(),
  priority: z.string().optional(),
  department: z.string().optional(),
  location: z.string().optional(),
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
