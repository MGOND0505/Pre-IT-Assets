import { z } from "zod";
import { TASK_PRIORITIES, TASK_STATUSES } from "../../models/Task";

export const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional().default(""),
  assignedTo: z.string().min(1),
  dueDate: z.coerce.date().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  ticket: z.string().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  dueDate: z.coerce.date().nullable().optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
});

export const setTaskStatusSchema = z.object({
  status: z.enum(TASK_STATUSES),
});

export const assignTaskSchema = z.object({
  assigneeId: z.string().min(1),
});

export const listTasksQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
  search: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  assignedTo: z.string().optional(),
});

export const taskIdParamsSchema = z.object({
  id: z.string().min(1),
});

export const ticketIdParamsSchema = z.object({
  ticketId: z.string().min(1),
});
