import type { NextFunction, Request, Response } from "express";
import { Router } from "express";
import { authorize, requireAdmin, requireModuleEnabled } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import { uploadTicketAttachment } from "../../utils/upload";
import { ApiError } from "../../utils/ApiError";
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

/** Which permission actually gates a status change depends on the REQUESTED transition (plain
 * update, reopen, or close) - the controller's own per-transition checks (setTicketStatus) do
 * that precise gating. This route-level check only needs to confirm the caller holds at least
 * one of the three write-adjacent permissions, so someone whose only relevant grant is
 * `helpdesk:reopen` (e.g. a default Employee) can actually reach the endpoint at all - a flat
 * `authorize("helpdesk","update")` here would 403 them before the controller's reopen check ever
 * runs, making that permission dead. */
function requireAnyStatusChangePermission(req: Request, _res: Response, next: NextFunction) {
  const perms = req.user!.permissions.helpdesk;
  if (req.user!.isAdmin || perms.update || perms.reopen || perms.close) {
    next();
    return;
  }
  next(new ApiError(403, "You do not have permission to change this ticket's status"));
}

helpdeskRouter.get("/stats", authorize("helpdesk", "view"), helpdeskController.getHelpdeskStats);
helpdeskRouter.get(
  "/dashboard-summary",
  authorize("helpdesk", "view"),
  validate({ query: dashboardSummaryQuerySchema }),
  helpdeskController.getHelpdeskDashboardSummary
);
// Always "mine", independent of the view-all permission dashboard-summary above ignores
// entirely - powers the Employee Portal dashboard's "My Tickets" widget.
helpdeskRouter.get("/my-summary", authorize("helpdesk", "view"), helpdeskController.getMyTicketSummary);

helpdeskRouter.get(
  "/deleted",
  requireAdmin,
  requireModuleEnabled("recycleBin"),
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
  requireAnyStatusChangePermission,
  validate({ params: ticketIdParamsSchema, body: setTicketStatusSchema }),
  helpdeskController.setTicketStatus
);
helpdeskRouter.patch(
  "/:id/assign",
  authorize("helpdesk", "assign"),
  validate({ params: ticketIdParamsSchema, body: assignTicketSchema }),
  helpdeskController.assignTicket
);
helpdeskRouter.get(
  "/:id/assignment-history",
  authorize("helpdesk", "view"),
  validate({ params: ticketIdParamsSchema }),
  helpdeskController.getAssignmentHistory
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
  requireModuleEnabled("recycleBin"),
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
