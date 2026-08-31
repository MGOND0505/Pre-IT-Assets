import { z } from "zod";

export const chatSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
    .max(20)
    .optional(),
});

export const tokenSchema = z.object({
  token: z.string().min(1),
});
