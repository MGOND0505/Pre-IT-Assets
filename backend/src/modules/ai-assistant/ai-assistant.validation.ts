import { z } from "zod";

export const chatSchema = z.object({
  message: z.string().min(1).max(4000),
  conversationId: z.string().optional(),
});

export const confirmTicketSchema = z.object({
  subject: z.string().min(1).max(200),
  description: z.string().max(10_000).optional().default(""),
  categoryName: z.string().max(100).nullable().optional(),
  priority: z.string().max(100).nullable().optional(),
});

export const conversationIdParamsSchema = z.object({
  id: z.string().min(1),
});
