import { Schema, model, type Types } from "mongoose";

export interface ITicketAttachment {
  fileName: string;
  storedName: string;
  size: number;
}

export interface ITicketComment {
  organization: Types.ObjectId;
  ticket: Types.ObjectId;
  author: Types.ObjectId;
  body: string;
  // Internal notes are visible only to callers with helpdesk:internalNote - see
  // helpdesk.service.ts#listComments, which filters these out for everyone else.
  isInternal: boolean;
  attachments: ITicketAttachment[];
}

const ticketCommentSchema = new Schema<ITicketComment>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    ticket: { type: Schema.Types.ObjectId, ref: "Ticket", required: true, index: true },
    author: { type: Schema.Types.ObjectId, ref: "User", required: true },
    body: { type: String, default: "" },
    isInternal: { type: Boolean, default: false },
    attachments: {
      type: [
        {
          fileName: { type: String, required: true },
          storedName: { type: String, required: true },
          size: { type: Number, required: true },
        },
      ],
      default: [],
    },
  },
  { timestamps: { createdAt: "createdDate", updatedAt: false } }
);

export const TicketComment = model<ITicketComment>("TicketComment", ticketCommentSchema);
