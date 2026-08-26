import type { Request, Response } from "express";
import path from "node:path";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok, fail } from "../../utils/response";
import { ApiError } from "../../utils/ApiError";
import { TICKET_ATTACHMENTS_DIR } from "../../utils/upload";
import { logAction } from "../audit/audit.service";
import * as helpdeskService from "./helpdesk.service";
import * as ticketCommentsService from "./ticketComments.service";
import { notifyTicketEvent } from "./helpdeskNotifications";

/** Ticket refs (requester/assignedAgent/...) are always populated by helpdesk.service.ts's
 * getTicketById - this pulls the raw id back out regardless, so notification helpers never care
 * whether they were handed a populated doc or a raw ObjectId. */
function idOf(ref: unknown): string | null {
  if (!ref) return null;
  if (typeof ref === "string") return ref;
  return String((ref as { _id: unknown })._id ?? ref);
}

export const listTickets = asyncHandler(async (req: Request, res: Response) => {
  const result = await helpdeskService.listTickets(req.query as never, req.organization!._id, {
    id: req.user!.id,
    isAdmin: req.user!.isAdmin,
    permissions: req.user!.permissions,
  });
  ok(res, result, "Tickets");
});

export const getTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await helpdeskService.getTicketById(req.params.id, req.organization!._id);
  ok(res, ticket, "Ticket");
});

export const createTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await helpdeskService.createTicket(req.body, req.organization!._id, req.user!.id);

  await logAction({
    req,
    action: "CREATE",
    module: "Ticket",
    recordId: ticket.id,
    recordLabel: ticket.ticketId,
    newValue: { subject: ticket.subject, priority: req.body.priority },
  });

  const vars = { ticketId: ticket.ticketId, subject: ticket.subject };
  await notifyTicketEvent("ticketCreated", idOf(ticket.requester), req.organization!._id, vars);
  if (ticket.assignedAgent) {
    await notifyTicketEvent("ticketAssigned", idOf(ticket.assignedAgent), req.organization!._id, vars);
  }

  ok(res, ticket, "Ticket created", 201);
});

export const updateTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await helpdeskService.updateTicket(req.params.id, req.body, req.organization!._id);

  await logAction({
    req,
    action: "UPDATE",
    module: "Ticket",
    recordId: ticket.id,
    recordLabel: ticket.ticketId,
    newValue: req.body,
  });

  ok(res, ticket, "Ticket updated");
});

export const setTicketStatus = asyncHandler(async (req: Request, res: Response) => {
  const before = await helpdeskService.getTicketById(req.params.id, req.organization!._id);

  if (before.status === "Closed" && req.body.status === "Reopened" && !req.user!.isAdmin && !req.user!.permissions.helpdesk.reopen) {
    throw new ApiError(403, "You do not have permission to reopen a closed ticket");
  }
  if (["Closed"].includes(req.body.status) && !req.user!.isAdmin && !req.user!.permissions.helpdesk.close) {
    throw new ApiError(403, "You do not have permission to close this ticket");
  }

  const ticket = await helpdeskService.setTicketStatus(req.params.id, req.body.status, req.body.resolution, req.organization!._id);

  await logAction({
    req,
    action: req.body.status === "Reopened" ? "REOPEN" : req.body.status === "Closed" ? "CLOSE" : "STATUS_CHANGE",
    module: "Ticket",
    recordId: ticket.id,
    recordLabel: ticket.ticketId,
    oldValue: { status: before.status },
    newValue: { status: ticket.status },
  });

  const vars = { ticketId: ticket.ticketId, subject: ticket.subject, status: ticket.status };
  const templateKey = ticket.status === "Resolved" ? "ticketResolved" : ticket.status === "Closed" ? "ticketClosed" : "ticketStatusChanged";
  await notifyTicketEvent(templateKey, idOf(ticket.requester), req.organization!._id, vars);

  ok(res, ticket, "Ticket status updated");
});

export const assignTicket = asyncHandler(async (req: Request, res: Response) => {
  const before = await helpdeskService.getTicketById(req.params.id, req.organization!._id);

  if (before.assignedAgent && !req.user!.isAdmin && !req.user!.permissions.helpdesk.reassign) {
    throw new ApiError(403, "You do not have permission to reassign this ticket");
  }

  const ticket = await helpdeskService.assignTicket(req.params.id, req.body.agentId, req.organization!._id);

  await logAction({
    req,
    action: before.assignedAgent ? "REASSIGN" : "ASSIGN",
    module: "Ticket",
    recordId: ticket.id,
    recordLabel: ticket.ticketId,
    oldValue: { assignedAgent: before.assignedAgent },
    newValue: { assignedAgent: req.body.agentId },
  });

  await notifyTicketEvent(
    before.assignedAgent ? "ticketReassigned" : "ticketAssigned",
    req.body.agentId,
    req.organization!._id,
    { ticketId: ticket.ticketId, subject: ticket.subject }
  );

  ok(res, ticket, "Ticket assigned");
});

export const deleteTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await helpdeskService.deleteTicket(req.params.id, req.user!.id, req.organization!._id);

  await logAction({
    req,
    action: "DELETE",
    module: "Ticket",
    recordId: req.params.id,
    recordLabel: ticket.ticketId,
  });

  ok(res, null, "Ticket deleted");
});

export const getHelpdeskStats = asyncHandler(async (req: Request, res: Response) => {
  const stats = await helpdeskService.getHelpdeskStats(req.organization!._id);
  ok(res, stats, "Helpdesk stats");
});

export const getHelpdeskDashboardSummary = asyncHandler(async (req: Request, res: Response) => {
  const { days } = req.query as unknown as { days?: number };
  const summary = await helpdeskService.getHelpdeskDashboardSummary(req.organization!._id, days);
  ok(res, summary, "Helpdesk dashboard summary");
});

export const listDeletedTickets = asyncHandler(async (req: Request, res: Response) => {
  const result = await helpdeskService.listTickets(
    { ...(req.query as unknown as Record<string, unknown>), includeDeleted: true },
    req.organization!._id,
    { id: req.user!.id, isAdmin: req.user!.isAdmin, permissions: req.user!.permissions }
  );
  ok(res, result, "Deleted tickets");
});

export const restoreTicket = asyncHandler(async (req: Request, res: Response) => {
  const ticket = await helpdeskService.restoreTicket(req.params.id, req.organization!._id);

  await logAction({ req, action: "RESTORE", module: "Ticket", recordId: ticket.id, recordLabel: ticket.ticketId });

  ok(res, ticket, "Ticket restored");
});

export const listComments = asyncHandler(async (req: Request, res: Response) => {
  const includeInternal = req.user!.isAdmin || Boolean(req.user!.permissions.helpdesk.internalNote);
  const comments = await ticketCommentsService.listComments(req.params.id, req.organization!._id, includeInternal);
  ok(res, comments, "Comments");
});

export const addComment = asyncHandler(async (req: Request, res: Response) => {
  if (req.body.isInternal && !req.user!.isAdmin && !req.user!.permissions.helpdesk.internalNote) {
    throw new ApiError(403, "You do not have permission to add internal notes");
  }

  const attachments = (req.files as Express.Multer.File[] | undefined)?.map((f) => ({
    fileName: f.originalname,
    storedName: f.filename,
    size: f.size,
  }));

  if (attachments && attachments.length > 0 && !req.user!.isAdmin && !req.user!.permissions.helpdesk.manageAttachments) {
    throw new ApiError(403, "You do not have permission to add attachments");
  }

  const comment = await ticketCommentsService.addComment(req.params.id, req.organization!._id, req.user!.id, {
    ...req.body,
    attachments,
  });

  await logAction({
    req,
    action: req.body.isInternal ? "ADD_INTERNAL_NOTE" : "ADD_COMMENT",
    module: "Ticket",
    recordId: req.params.id,
  });

  // Internal notes are never emailed to the requester - only public comments notify "the other
  // side" of the conversation (whichever of requester/agent didn't just write it).
  if (!req.body.isInternal) {
    const ticket = await helpdeskService.getTicketById(req.params.id, req.organization!._id);
    const requesterId = idOf(ticket.requester);
    const agentId = idOf(ticket.assignedAgent);
    const recipientId = req.user!.id === requesterId ? agentId : requesterId;
    await notifyTicketEvent("ticketCommentAdded", recipientId, req.organization!._id, {
      ticketId: ticket.ticketId,
      subject: ticket.subject,
    });
  }

  ok(res, comment, "Comment added", 201);
});

export const downloadAttachment = asyncHandler(async (req: Request, res: Response) => {
  await helpdeskService.getTicketById(req.params.id, req.organization!._id); // 404s if wrong org
  const includeInternal = req.user!.isAdmin || Boolean(req.user!.permissions.helpdesk.internalNote);
  const attachment = await ticketCommentsService.getAttachment(
    req.params.id,
    req.organization!._id,
    req.params.storedName,
    includeInternal
  );

  const filePath = path.join(TICKET_ATTACHMENTS_DIR, attachment.storedName);
  res.download(filePath, attachment.fileName, (err) => {
    if (err) fail(res, "Could not download file", 404);
  });
});
