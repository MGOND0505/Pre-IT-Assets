import { Router } from "express";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as aiAssistantController from "./ai-assistant.controller";
import { chatSchema, confirmTicketSchema, conversationIdParamsSchema } from "./ai-assistant.validation";

export const aiAssistantRouter = Router();

aiAssistantRouter.post(
  "/chat",
  authorize("aiAssistant", "view"),
  validate({ body: chatSchema }),
  aiAssistantController.chat
);

// Deliberately gated identically to the normal ticket-creation route (authorize("helpdesk",
// "create")) - this is the ONLY place a ticket the AI Assistant proposed is ever actually
// created. Nothing in the /chat tool-call loop touches the database for a ticket.
aiAssistantRouter.post(
  "/confirm-ticket",
  authorize("helpdesk", "create"),
  validate({ body: confirmTicketSchema }),
  aiAssistantController.confirmTicket
);

aiAssistantRouter.get(
  "/conversations/:id",
  authorize("aiAssistant", "view"),
  validate({ params: conversationIdParamsSchema }),
  aiAssistantController.getConversation
);
