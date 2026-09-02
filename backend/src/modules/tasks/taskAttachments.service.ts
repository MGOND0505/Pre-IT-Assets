import fs from "node:fs/promises";
import path from "node:path";
import { TaskAttachment } from "../../models/TaskAttachment";
import { ApiError } from "../../utils/ApiError";
import { TASK_ATTACHMENTS_DIR } from "../../utils/upload";

/** Mirrors modules/assets/assetDocuments.service.ts exactly. */

export async function listTaskAttachments(taskId: string, organizationId: string) {
  return TaskAttachment.find({ task: taskId, organization: organizationId }).sort({ createdDate: -1 });
}

export async function createTaskAttachment(input: {
  task: string;
  organization: string;
  originalName: string;
  storedFileName: string;
  mimeType: string;
  size: number;
  uploadedBy: string;
}) {
  return TaskAttachment.create(input);
}

export async function getTaskAttachment(taskId: string, attachmentId: string, organizationId: string) {
  const attachment = await TaskAttachment.findOne({ _id: attachmentId, task: taskId, organization: organizationId });
  if (!attachment) throw new ApiError(404, "Attachment not found");
  return attachment;
}

export async function deleteTaskAttachment(taskId: string, attachmentId: string, organizationId: string) {
  const attachment = await getTaskAttachment(taskId, attachmentId, organizationId);
  await fs.unlink(path.join(TASK_ATTACHMENTS_DIR, attachment.storedFileName)).catch(() => {
    /* file already gone - fine */
  });
  await attachment.deleteOne();
  return attachment;
}
