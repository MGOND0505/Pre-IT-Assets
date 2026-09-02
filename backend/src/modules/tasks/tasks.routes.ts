import { Router } from "express";
import { authorize, requireAdmin, requireModuleEnabled } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { uploadTaskAttachment } from "../../utils/upload";
import * as tasksController from "./tasks.controller";
import * as taskAttachmentsController from "./taskAttachments.controller";
import {
  addTaskCommentSchema,
  assignTaskSchema,
  createTaskSchema,
  listTasksQuerySchema,
  setTaskStatusSchema,
  taskAttachmentParamsSchema,
  taskIdParamsSchema,
  ticketIdParamsSchema,
  updateTaskSchema,
} from "./tasks.validation";

export const tasksRouter = Router();

tasksRouter.get(
  "/by-ticket/:ticketId",
  authorize("tasks", "view"),
  validate({ params: ticketIdParamsSchema }),
  tasksController.listSubtasksForTicket
);

// Always "mine" (assigned to me or created by me), independent of the tasks:assign view-all
// permission - powers the Employee Portal dashboard's "My Tasks" widget. No org-wide task stats
// endpoint exists to mirror; mounted ahead of "/:id" so Express never mistakes it for one.
tasksRouter.get("/my-summary", authorize("tasks", "view"), tasksController.getMyTaskSummary);

tasksRouter.get(
  "/deleted",
  requireAdmin,
  requireModuleEnabled("recycleBin"),
  validate({ query: listTasksQuerySchema }),
  tasksController.listDeletedTasks
);
tasksRouter.get("/", authorize("tasks", "view"), validate({ query: listTasksQuerySchema }), tasksController.listTasks);
tasksRouter.post("/", authorize("tasks", "create"), validate({ body: createTaskSchema }), tasksController.createTask);
tasksRouter.get(
  "/:id",
  authorize("tasks", "view"),
  validate({ params: taskIdParamsSchema }),
  tasksController.getTask
);
tasksRouter.put(
  "/:id",
  authorize("tasks", "update"),
  validate({ params: taskIdParamsSchema, body: updateTaskSchema }),
  tasksController.updateTask
);
// Deliberately gated on "view" here, not "update" - an assignee without the broader tasks:update
// grant must still be able to mark their OWN task's status (see tasksController.setTaskStatus's
// own isAdmin || tasks.update || "I'm the assignee" check). Anyone without even "view" never gets
// this far regardless.
tasksRouter.patch(
  "/:id/status",
  authorize("tasks", "view"),
  validate({ params: taskIdParamsSchema, body: setTaskStatusSchema }),
  tasksController.setTaskStatus
);
tasksRouter.patch(
  "/:id/assign",
  authorize("tasks", "assign"),
  validate({ params: taskIdParamsSchema, body: assignTaskSchema }),
  tasksController.assignTask
);
tasksRouter.delete(
  "/:id",
  authorize("tasks", "delete"),
  validate({ params: taskIdParamsSchema }),
  tasksController.deleteTask
);
tasksRouter.post(
  "/:id/restore",
  requireAdmin,
  requireModuleEnabled("recycleBin"),
  validate({ params: taskIdParamsSchema }),
  tasksController.restoreTask
);

tasksRouter.get(
  "/:id/assignment-history",
  authorize("tasks", "view"),
  validate({ params: taskIdParamsSchema }),
  tasksController.getAssignmentHistory
);

tasksRouter.get(
  "/:id/attachments",
  authorize("tasks", "view"),
  validate({ params: taskIdParamsSchema }),
  taskAttachmentsController.listAttachments
);
tasksRouter.post(
  "/:id/attachments",
  authorize("tasks", "manageAttachments"),
  validate({ params: taskIdParamsSchema }),
  uploadTaskAttachment.single("file"),
  taskAttachmentsController.uploadAttachment
);
tasksRouter.get(
  "/:id/attachments/:attachmentId/download",
  authorize("tasks", "view"),
  validate({ params: taskAttachmentParamsSchema }),
  taskAttachmentsController.downloadAttachment
);
tasksRouter.delete(
  "/:id/attachments/:attachmentId",
  authorize("tasks", "manageAttachments"),
  validate({ params: taskAttachmentParamsSchema }),
  taskAttachmentsController.deleteAttachment
);

tasksRouter.get(
  "/:id/comments",
  authorize("tasks", "view"),
  validate({ params: taskIdParamsSchema }),
  tasksController.listComments
);
tasksRouter.post(
  "/:id/comments",
  authorize("tasks", "comment"),
  validate({ params: taskIdParamsSchema, body: addTaskCommentSchema }),
  tasksController.addComment
);
