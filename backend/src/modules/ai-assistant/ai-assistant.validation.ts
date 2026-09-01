import { z } from "zod";

export const chatSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
});

export const confirmTicketSchema = z.object({
  subject: z.string().min(1),
  description: z.string().optional().default(""),
  categoryName: z.string().nullable().optional(),
  priority: z.string().nullable().optional(),
});

export const conversationIdParamsSchema = z.object({
  id: z.string().min(1),
});
