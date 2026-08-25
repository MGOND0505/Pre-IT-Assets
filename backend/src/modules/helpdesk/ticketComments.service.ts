import { TicketComment } from "../../models/TicketComment";
import { Ticket } from "../../models/Ticket";
import { ApiError } from "../../utils/ApiError";

type CreateInput = {
  body: string;
  isInternal?: boolean;
  attachments?: { fileName: string; storedName: string; size: number }[];
};

export async function listComments(ticketId: string, organizationId: string, includeInternal: boolean) {
  const filter: Record<string, unknown> = { ticket: ticketId, organization: organizationId };
  if (!includeInternal) filter.isInternal = false;

  return TicketComment.find(filter).populate({ path: "author", select: "name email" }).sort({ createdDate: 1 });
}

/** Confirms the attachment actually belongs to a comment on THIS ticket (in this org) before a
 * download is allowed - the stored filename alone is an unguessable UUID, but that's obscurity,
 * not authorization; this is the real ownership check, mirroring how asset document downloads
 * verify the document belongs to the requested asset before serving it. */
export async function getAttachment(ticketId: string, organizationId: string, storedName: string, includeInternal: boolean) {
  const filter: Record<string, unknown> = {
    ticket: ticketId,
    organization: organizationId,
    "attachments.storedName": storedName,
  };
  if (!includeInternal) filter.isInternal = false;

  const comment = await TicketComment.findOne(filter);
  if (!comment) throw new ApiError(404, "Attachment not found");
  return comment.attachments.find((a) => a.storedName === storedName)!;
}

export async function addComment(ticketId: string, organizationId: string, authorId: string, input: CreateInput) {
  const ticket = await Ticket.findOne({ _id: ticketId, organization: organizationId, isDeleted: false });
  if (!ticket) throw new ApiError(404, "Ticket not found");

  const comment = await TicketComment.create({
    organization: organizationId,
    ticket: ticketId,
    author: authorId,
    body: input.body,
    isInternal: input.isInternal ?? false,
    attachments: input.attachments ?? [],
  });

  // First reply from anyone OTHER than the requester counts as the ticket's first response,
  // for response-time SLA tracking - a requester adding their own follow-up comment doesn't.
  if (!ticket.firstResponseAt && String(ticket.requester) !== authorId) {
    ticket.firstResponseAt = new Date();
    await ticket.save();
  }

  return TicketComment.findById(comment._id).populate({ path: "author", select: "name email" });
}
