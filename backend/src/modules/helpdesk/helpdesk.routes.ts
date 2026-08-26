import { Router } from "express";
import { authorize, requireAdmin } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { uploadTicketAttachment } from "../../utils/upload";
import * as helpdeskController from "./helpdesk.controller";
import {
  addCommentSchema,
  assignTicketSchema,
  createTicketSchema,
  dashboardSummaryQuerySchema,
  listTicketsQuerySchema,
  setTicketStatusSchema,
  ticketIdParamsSchema,
  updateTicketSchema,
} from "./helpdesk.validation";

export const helpdeskRouter = Router();

helpdeskRouter.get("/stats", authorize("helpdesk", "view"), helpdeskController.getHelpdeskStats);
helpdeskRouter.get(
  "/dashboard-summary",
  authorize("helpdesk", "view"),
  validate({ query: dashboardSummaryQuerySchema }),
  helpdeskController.getHelpdeskDashboardSummary
);

helpdeskRouter.get(
  "/deleted",
  requireAdmin,
  validate({ query: listTicketsQuerySchema }),
  helpdeskController.listDeletedTickets
);

helpdeskRouter.get(
  "/",
  authorize("helpdesk", "view"),
  validate({ query: listTicketsQuerySchema }),
  helpdeskController.listTickets
);
helpdeskRouter.post(
  "/",
  authorize("helpdesk", "create"),
  validate({ body: createTicketSchema }),
  helpdeskController.createTicket
);
helpdeskRouter.get(
  "/:id",
  authorize("helpdesk", "view"),
  validate({ params: ticketIdParamsSchema }),
  helpdeskController.getTicket
);
helpdeskRouter.put(
  "/:id",
  authorize("helpdesk", "update"),
  validate({ params: ticketIdParamsSchema, body: updateTicketSchema }),
  helpdeskController.updateTicket
);
helpdeskRouter.patch(
  "/:id/status",
  authorize("helpdesk", "update"),
  validate({ params: ticketIdParamsSchema, body: setTicketStatusSchema }),
  helpdeskController.setTicketStatus
);
helpdeskRouter.patch(
  "/:id/assign",
  authorize("helpdesk", "assign"),
  validate({ params: ticketIdParamsSchema, body: assignTicketSchema }),
  helpdeskController.assignTicket
);
helpdeskRouter.delete(
  "/:id",
  authorize("helpdesk", "delete"),
  validate({ params: ticketIdParamsSchema }),
  helpdeskController.deleteTicket
);
helpdeskRouter.post(
  "/:id/restore",
  requireAdmin,
  validate({ params: ticketIdParamsSchema }),
  helpdeskController.restoreTicket
);

helpdeskRouter.get(
  "/:id/comments",
  authorize("helpdesk", "view"),
  validate({ params: ticketIdParamsSchema }),
  helpdeskController.listComments
);
helpdeskRouter.post(
  "/:id/comments",
  authorize("helpdesk", "comment"),
  uploadTicketAttachment.array("attachments", 5),
  validate({ params: ticketIdParamsSchema, body: addCommentSchema }),
  helpdeskController.addComment
);
helpdeskRouter.get(
  "/:id/attachments/:storedName/download",
  authorize("helpdesk", "view"),
  helpdeskController.downloadAttachment
);
