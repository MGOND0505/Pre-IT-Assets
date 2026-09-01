import { z } from "zod";

export const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  sessionId: z.string().min(1).optional(),
});

export const tokenSchema = z.object({
  token: z.string().min(1),
});

export const sessionIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const listSessionsQuerySchema = z.object({
  scope: z.enum(["mine", "all"]).optional().default("mine"),
  userId: z.string().min(1).optional(),
});
