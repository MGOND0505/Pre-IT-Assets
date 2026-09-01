import type { Request, Response } from "express";
import path from "node:path";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok, fail } from "../../utils/response";
import { ApiError } from "../../utils/ApiError";
import { User } from "../../models/User";
import { TICKET_ATTACHMENTS_DIR } from "../../utils/upload";
import { logAction } from "../audit/audit.service";
import * as helpdeskService from "./helpdesk.service";
import { REOPEN_WINDOW_HOURS } from "./helpdesk.service";
import * as ticketCommentsService from "./ticketComments.service";
import * as assignmentHistoryService from "./assignmentHistory.service";
import { notifyTicketEvent, buildAssignmentVars, nameOf, idOf } from "./helpdeskNotifications";

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

  await notifyTicketEvent("ticketCreated", idOf(ticket.requester), req.organization!._id, {
    ticketId: ticket.ticketId,
    subject: ticket.subject,
  });

  // Auto-assigned via the ticket's category defaultAgent (helpdesk.service.ts#resolveAutoAssignee)
  // - status "Auto-Forwarded" is the signal that it went to the backup agent instead of the
  // category's own default agent, who must currently be on leave.
  if (ticket.assignedAgent) {
    const wasAutoForwarded = ticket.status === "Auto-Forwarded";
    const vars = buildAssignmentVars(ticket, {
      assignedBy: wasAutoForwarded ? "Auto-forwarded (category default agent on leave)" : "Category default agent",
    });
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
  if (before.status === "Closed" && req.body.status === "Reopened") {
    const reopenDeadline = before.closedAt ? before.closedAt.getTime() + REOPEN_WINDOW_HOURS * 60 * 60 * 1000 : 0;
    if (Date.now() > reopenDeadline) {
      throw new ApiError(400, `This ticket was closed more than ${REOPEN_WINDOW_HOURS} hours ago and can no longer be reopened. Please create a new ticket instead.`);
    }
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

/**
 * The full "reassign one ticket" side-effect chain (mutate + audit + both notifications) -
 * shared by the direct PATCH /:id/assign route below AND users.controller.ts#setLeaveStatus's
 * bulk on-leave handover, so a handed-over ticket gets exactly the same audit trail, Assignment
 * History entry, and emails as a manually reassigned one. `assignedByLabel` lets a caller other
 * than "the logged-in user reassigning by hand" (e.g. an admin marking someone on leave) describe
 * itself in the email/history instead of defaulting to req.user's own name.
 */
export async function reassignTicketAndNotify(
  ticketId: string,
  newAgentId: string,
  organizationId: string,
  req: Request,
  assignedByLabel?: string
) {
  const before = await helpdeskService.getTicketById(ticketId, organizationId);
  const wasAssigned = Boolean(before.assignedAgent);
  const previousAgentId = idOf(before.assignedAgent);

  const ticket = await helpdeskService.assignTicket(ticketId, newAgentId, organizationId);

  let actorName = assignedByLabel;
  if (!actorName) {
    const actor = await User.findById(req.user!.id).select("name");
    actorName = actor?.name ?? "Unknown";
  }

  await logAction({
    req,
    action: wasAssigned ? "REASSIGN" : "ASSIGN",
    module: "Ticket",
    recordId: ticket.id,
    recordLabel: ticket.ticketId,
    oldValue: previousAgentId ? { agentId: previousAgentId, agentName: nameOf(before.assignedAgent) } : null,
    newValue: { agentId: newAgentId, agentName: nameOf(ticket.assignedAgent) },
  });

  const vars = buildAssignmentVars(ticket, {
    assignedBy: actorName,
    previousAgent: wasAssigned ? nameOf(before.assignedAgent) : undefined,
  });
  await notifyTicketEvent(wasAssigned ? "ticketReassigned" : "ticketAssigned", newAgentId, organizationId, vars);

  // The outgoing agent (if any, and if actually different from the new one) is no longer on the
  // hook for this ticket - they should know it left their queue rather than find out by it
  // silently disappearing from their list.
  if (wasAssigned && previousAgentId && previousAgentId !== newAgentId) {
    await notifyTicketEvent("ticketUnassigned", previousAgentId, organizationId, vars);
  }

  return ticket;
}

export const assignTicket = asyncHandler(async (req: Request, res: Response) => {
  const before = await helpdeskService.getTicketById(req.params.id, req.organization!._id);
  if (before.assignedAgent && !req.user!.isAdmin && !req.user!.permissions.helpdesk.reassign) {
    throw new ApiError(403, "You do not have permission to reassign this ticket");
  }

  const ticket = await reassignTicketAndNotify(req.params.id, req.body.agentId, req.organization!._id, req);
  ok(res, ticket, "Ticket assigned");
});

export const getAssignmentHistory = asyncHandler(async (req: Request, res: Response) => {
  await helpdeskService.getTicketById(req.params.id, req.organization!._id); // 404s + org-scopes

  const canViewHistory = req.user!.isAdmin || req.user!.permissions.helpdesk.assign || req.user!.permissions.helpdesk.update;
  if (!canViewHistory) {
    throw new ApiError(403, "You do not have permission to view this ticket's assignment history");
  }

  const history = await assignmentHistoryService.listTicketAssignmentHistory(req.params.id, req.organization!._id);
  ok(res, history, "Assignment history");
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
