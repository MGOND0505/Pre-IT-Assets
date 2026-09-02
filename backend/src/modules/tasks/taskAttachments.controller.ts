import type { Request, Response } from "express";
import path from "node:path";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok, fail } from "../../utils/response";
import { ApiError } from "../../utils/ApiError";
import { TASK_ATTACHMENTS_DIR } from "../../utils/upload";
import { logAction } from "../audit/audit.service";
import * as tasksService from "./tasks.service";
import * as taskAttachmentsService from "./taskAttachments.service";

/** Mirrors modules/assets/assetDocuments.controller.ts exactly. */

function requestingUserFrom(req: Request) {
  return { id: req.user!.id, isAdmin: req.user!.isAdmin, permissions: req.user!.permissions };
}

export const listAttachments = asyncHandler(async (req: Request, res: Response) => {
  await tasksService.getTaskByIdForRequester(req.params.id, req.organization!._id, requestingUserFrom(req));
  const attachments = await taskAttachmentsService.listTaskAttachments(req.params.id, req.organization!._id);
  ok(res, attachments, "Attachments");
});

export const uploadAttachment = asyncHandler(async (req: Request, res: Response) => {
  if (!req.file) {
    throw new ApiError(400, "No file uploaded");
  }
  const task = await tasksService.getTaskByIdForRequester(req.params.id, req.organization!._id, requestingUserFrom(req));

  const attachment = await taskAttachmentsService.createTaskAttachment({
    task: req.params.id,
    organization: req.organization!._id,
    originalName: req.file.originalname,
    storedFileName: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
    uploadedBy: req.user!.id,
  });

  await logAction({
    req,
    action: "UPLOAD_ATTACHMENT",
    module: "Task",
    recordId: req.params.id,
    recordLabel: `${task.taskId}: ${attachment.originalName}`,
  });

  ok(res, attachment, "Attachment uploaded", 201);
});

export const downloadAttachment = asyncHandler(async (req: Request, res: Response) => {
  await tasksService.getTaskByIdForRequester(req.params.id, req.organization!._id, requestingUserFrom(req));
  const attachment = await taskAttachmentsService.getTaskAttachment(req.params.id, req.params.attachmentId, req.organization!._id);
  const filePath = path.join(TASK_ATTACHMENTS_DIR, attachment.storedFileName);
  res.download(filePath, attachment.originalName, (err) => {
    if (err) fail(res, "Could not download file", 404);
  });
});

export const deleteAttachment = asyncHandler(async (req: Request, res: Response) => {
  const task = await tasksService.getTaskByIdForRequester(req.params.id, req.organization!._id, requestingUserFrom(req));
  const attachment = await taskAttachmentsService.deleteTaskAttachment(req.params.id, req.params.attachmentId, req.organization!._id);

  await logAction({
    req,
    action: "DELETE_ATTACHMENT",
    module: "Task",
    recordId: req.params.id,
    recordLabel: `${task.taskId}: ${attachment.originalName}`,
  });

  ok(res, null, "Attachment deleted");
});
