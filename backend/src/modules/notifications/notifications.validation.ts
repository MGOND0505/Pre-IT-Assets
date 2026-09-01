import { z } from "zod";

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

export const notificationIdParamsSchema = z.object({
  id: z.string().min(1),
});
