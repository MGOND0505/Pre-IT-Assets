import { Router } from "express";
import { authorize } from "../../middleware/authorize";
import { validate } from "../../middleware/validate";
import * as aiAssistantController from "./ai-assistant.controller";
import { chatSchema, tokenSchema } from "./ai-assistant.validation";

export const aiAssistantRouter = Router();

aiAssistantRouter.post(
  "/chat",
  authorize("aiAssistant", "view"),
  validate({ body: chatSchema }),
  aiAssistantController.chat
);

// Confirm/cancel re-check the *target* module's own permission (assets:update/create) inside
// applyPendingChange - authorize("aiAssistant","view") here only gates "can reach AssetIQ AI at
// all", the same defense-in-depth every other write endpoint in this app already has.
aiAssistantRouter.post(
  "/confirm",
  authorize("aiAssistant", "view"),
  validate({ body: tokenSchema }),
  aiAssistantController.confirmChange
);
aiAssistantRouter.post(
  "/cancel",
  authorize("aiAssistant", "view"),
  validate({ body: tokenSchema }),
  aiAssistantController.cancelChange
);
