import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { logAction } from "../audit/audit.service";
import * as tasksService from "./tasks.service";
import { notifyTaskEvent } from "./taskNotifications";

function idOf(ref: unknown): string | null {
  if (!ref) return null;
  if (typeof ref === "string") return ref;
  return String((ref as { _id: unknown })._id ?? ref);
}

export const listTasks = asyncHandler(async (req: Request, res: Response) => {
  const result = await tasksService.listTasks(req.query as never, req.organization!._id, {
    id: req.user!.id,
    isAdmin: req.user!.isAdmin,
    permissions: req.user!.permissions,
  });
  ok(res, result, "Tasks");
});

export const listSubtasksForTicket = asyncHandler(async (req: Request, res: Response) => {
  const tasks = await tasksService.listSubtasksForTicket(req.params.ticketId, req.organization!._id);
  ok(res, tasks, "Sub-tasks");
});

export const getTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await tasksService.getTaskById(req.params.id, req.organization!._id);
  ok(res, task, "Task");
});

export const createTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await tasksService.createTask(req.body, req.organization!._id, req.user!.id);

  await logAction({
    req,
    action: "CREATE",
    module: "Task",
    recordId: task.id,
    recordLabel: task.taskId,
    newValue: { title: task.title, assignedTo: req.body.assignedTo },
  });

  await notifyTaskEvent("taskAssigned", idOf(task.assignedTo), req.organization!._id, {
    taskId: task.taskId,
    title: task.title,
  });

  ok(res, task, "Task created", 201);
});

export const updateTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await tasksService.updateTask(req.params.id, req.body, req.organization!._id);

  await logAction({
    req,
    action: "UPDATE",
    module: "Task",
    recordId: task.id,
    recordLabel: task.taskId,
    newValue: req.body,
  });

  ok(res, task, "Task updated");
});

export const setTaskStatus = asyncHandler(async (req: Request, res: Response) => {
  const before = await tasksService.getTaskById(req.params.id, req.organization!._id);
  const task = await tasksService.setTaskStatus(req.params.id, req.body.status, req.organization!._id);

  await logAction({
    req,
    action: "STATUS_CHANGE",
    module: "Task",
    recordId: task.id,
    recordLabel: task.taskId,
    oldValue: { status: before.status },
    newValue: { status: task.status },
  });

  await notifyTaskEvent("taskStatusChanged", idOf(task.assignedBy), req.organization!._id, {
    taskId: task.taskId,
    title: task.title,
    status: task.status,
  });

  ok(res, task, "Task status updated");
});

export const assignTask = asyncHandler(async (req: Request, res: Response) => {
  const before = await tasksService.getTaskById(req.params.id, req.organization!._id);
  const task = await tasksService.assignTask(req.params.id, req.body.assigneeId, req.organization!._id);

  await logAction({
    req,
    action: "ASSIGN",
    module: "Task",
    recordId: task.id,
    recordLabel: task.taskId,
    oldValue: { assignedTo: before.assignedTo },
    newValue: { assignedTo: req.body.assigneeId },
  });

  await notifyTaskEvent("taskReassigned", req.body.assigneeId, req.organization!._id, {
    taskId: task.taskId,
    title: task.title,
  });

  ok(res, task, "Task reassigned");
});

export const deleteTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await tasksService.deleteTask(req.params.id, req.user!.id, req.organization!._id);

  await logAction({
    req,
    action: "DELETE",
    module: "Task",
    recordId: req.params.id,
    recordLabel: task.taskId,
  });

  ok(res, null, "Task deleted");
});

export const listDeletedTasks = asyncHandler(async (req: Request, res: Response) => {
  const result = await tasksService.listTasks(
    { ...(req.query as unknown as Record<string, unknown>), includeDeleted: true },
    req.organization!._id,
    { id: req.user!.id, isAdmin: req.user!.isAdmin, permissions: req.user!.permissions }
  );
  ok(res, result, "Deleted tasks");
});

export const restoreTask = asyncHandler(async (req: Request, res: Response) => {
  const task = await tasksService.restoreTask(req.params.id, req.organization!._id);

  await logAction({ req, action: "RESTORE", module: "Task", recordId: task.id, recordLabel: task.taskId });

  ok(res, task, "Task restored");
});
