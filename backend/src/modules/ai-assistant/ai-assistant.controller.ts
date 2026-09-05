import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { ApiError } from "../../utils/ApiError";
import { AiConversation, type IAiMessage } from "../../models/AiConversation";
import { AiActivityLog } from "../../models/AiActivityLog";
import { HelpdeskCategory } from "../../models/HelpdeskCategory";
import { HelpdeskPriority } from "../../models/HelpdeskPriority";
import { escapeRegex } from "../../utils/regex";
import * as helpdeskService from "../helpdesk/helpdesk.service";
import { chatWithTools, type OllamaMessage, type OllamaToolDefinition } from "./ollama.client";
import {
  getAvailableTools,
  executeTool,
  summarizeToolResult,
  extractReferences,
  type RequestingUser,
  type ToolReference,
} from "./ai-tools.service";

// A misbehaving/looping model can never hang a request forever - after this many tool-call
// round-trips, whatever partial answer exists is returned instead of looping indefinitely.
const MAX_TOOL_ITERATIONS = 5;

const SYSTEM_PROMPT =
  "You are the IT Asset Management AI Assistant for this organization. Use the provided tools to " +
  "look up real data (assets, licenses, helpdesk tickets, tasks, knowledge base articles, vendors, " +
  "departments, locations, and the user directory) - never invent data, and never claim to see more " +
  "than a tool actually returned. You only ever see what the current user is already allowed to see " +
  "in the normal application - some tools (like the user directory) are only offered to you at all " +
  "when the current user has permission to see that data themselves; if a tool isn't available or " +
  "returns nothing, say so honestly rather than guessing. If the user gives you a bare code, ID, or " +
  "serial number with no other context (it could belong to more than one module), ALWAYS call " +
  "search_everywhere FIRST rather than guessing a single search_<module> tool - it checks every " +
  "module in one call, so you never have to guess wrong and tell the user something wasn't found " +
  "when it actually exists in a different module. When a user wants to file a helpdesk ticket, use " +
  "propose_ticket to draft it - you can NEVER create a ticket directly; a human must separately " +
  "review and confirm the draft afterwards before it becomes real.";

function requestingUserFrom(req: Request): RequestingUser {
  return {
    id: req.user!.id,
    isAdmin: req.user!.isAdmin,
    permissions: req.user!.permissions,
    role: req.user!.role,
    enabledModules: req.organization!.enabledModules,
  };
}

function buildHistory(messages: IAiMessage[]): OllamaMessage[] {
  return [{ role: "system", content: SYSTEM_PROMPT }, ...messages.map((m) => ({ role: m.role, content: m.content }))];
}

type PendingTicket = { subject: string; description: string; categoryName: string | null; priority: string | null };

function appendMessage(conversation: InstanceType<typeof AiConversation>, message: Omit<IAiMessage, "createdAt">) {
  conversation.messages.push({ ...message, createdAt: new Date() });
}

export const chat = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organization!._id;
  const requestingUser = requestingUserFrom(req);
  const { message, conversationId } = req.body as { message: string; conversationId?: string };

  // Scoped to (organization, user) even when a conversationId is supplied - a stale/foreign/
  // expired id never surfaces someone else's conversation, it just silently starts a fresh one.
  let conversation = conversationId
    ? await AiConversation.findOne({ _id: conversationId, organization: organizationId, user: requestingUser.id })
    : null;
  if (!conversation) {
    conversation = await AiConversation.create({ organization: organizationId, user: requestingUser.id, messages: [] });
  }

  appendMessage(conversation, { role: "user", content: message });

  await AiActivityLog.create({
    organization: organizationId,
    user: requestingUser.id,
    action: "chat_message",
    toolName: null,
    summary: `User asked: "${message.slice(0, 200)}"`,
  });

  const availableTools = getAvailableTools(requestingUser);
  const ollamaTools: OllamaToolDefinition[] = availableTools.map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));

  let pendingTicket: PendingTicket | undefined;
  let finalContent: string | undefined;
  const references: ToolReference[] = [];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const result = await chatWithTools(buildHistory(conversation.messages), ollamaTools);

    if (!result.toolCalls || result.toolCalls.length === 0) {
      finalContent = result.content ?? "";
      break;
    }

    for (const call of result.toolCalls) {
      let toolResult: unknown;
      let toolFailed = false;
      try {
        // executeTool re-checks the permission gate itself - never trusts that a tool the model
        // requested was actually one it was offered.
        toolResult = await executeTool(call.name, call.arguments, requestingUser, organizationId);
      } catch (err) {
        toolFailed = true;
        toolResult = { error: err instanceof ApiError ? err.message : "Tool execution failed" };
      }

      const summary = toolFailed
        ? `Tool "${call.name}" could not run: ${(toolResult as { error: string }).error}`
        : summarizeToolResult(call.name, call.arguments, toolResult);

      appendMessage(conversation, { role: "tool", content: summary, toolName: call.name });

      await AiActivityLog.create({
        organization: organizationId,
        user: requestingUser.id,
        action: "tool_call",
        toolName: call.name,
        summary,
      });

      if (call.name === "propose_ticket" && !toolFailed) {
        pendingTicket = toolResult as PendingTicket;
      } else if (!toolFailed) {
        references.push(...extractReferences(call.name, toolResult));
      }
    }
    // Loop back with the new tool message(s) in history so the model can use their results.
  }

  if (finalContent === undefined) {
    finalContent =
      "I wasn't able to finish processing that request in time - please try rephrasing your question or asking again.";
  }

  appendMessage(conversation, { role: "assistant", content: finalContent });
  conversation.lastActivityAt = new Date();
  await conversation.save();

  // Same link can surface twice across tool calls/iterations (e.g. the model re-searching after
  // a refinement) - de-duped by link, and capped so the reply doesn't turn into a wall of cards.
  const dedupedReferences = Array.from(new Map(references.map((r) => [r.link, r])).values()).slice(0, 8);

  ok(res, { conversationId: conversation.id, reply: finalContent, pendingTicket, references: dedupedReferences }, "AI Assistant reply");
});

/** Resolves a model's free-text category/priority guess to a real org record via case-insensitive
 * exact-name match - never invents or auto-creates one. Category: falls back to unset/null if no
 * match (createTicket already handles an absent category gracefully). Priority: createTicket
 * requires a valid priority id, so an unresolved guess falls back to the org's own lowest-`order`
 * Active priority (the same one the normal ticket-creation form would show pre-selected) rather
 * than guessing wrong. */
async function resolveCategoryId(categoryName: string | null | undefined, organizationId: string): Promise<string | undefined> {
  if (!categoryName) return undefined;
  const category = await HelpdeskCategory.findOne({
    organization: organizationId,
    isDeleted: false,
    status: "Active",
    name: { $regex: `^${escapeRegex(categoryName)}$`, $options: "i" },
  });
  return category?.id;
}

async function resolvePriorityId(priorityName: string | null | undefined, organizationId: string): Promise<string | undefined> {
  if (priorityName) {
    const priority = await HelpdeskPriority.findOne({
      organization: organizationId,
      isDeleted: false,
      status: "Active",
      name: { $regex: `^${escapeRegex(priorityName)}$`, $options: "i" },
    });
    if (priority) return priority.id;
  }
  const fallback = await HelpdeskPriority.findOne({ organization: organizationId, isDeleted: false, status: "Active" }).sort({
    order: 1,
    name: 1,
  });
  return fallback?.id;
}

export const confirmTicket = asyncHandler(async (req: Request, res: Response) => {
  const organizationId = req.organization!._id;
  const { subject, description, categoryName, priority } = req.body as {
    subject: string;
    description: string;
    categoryName?: string | null;
    priority?: string | null;
  };

  const categoryId = await resolveCategoryId(categoryName, organizationId);
  const priorityId = await resolvePriorityId(priority, organizationId);
  if (!priorityId) {
    throw new ApiError(400, "No helpdesk priority is configured for this organization yet - ask an admin to add one first.");
  }

  const ticket = await helpdeskService.createTicket(
    { subject, description, category: categoryId, priority: priorityId },
    organizationId,
    req.user!.id
  );

  await AiActivityLog.create({
    organization: organizationId,
    user: req.user!.id,
    action: "ticket_created",
    toolName: "confirm_ticket",
    summary: `Confirmed and created ticket ${ticket.ticketId}: "${ticket.subject}"`,
  });

  ok(res, ticket, "Ticket created", 201);
});

export const getConversation = asyncHandler(async (req: Request, res: Response) => {
  // Scoped to the requesting user's own id - a user can never fetch another user's conversation.
  const conversation = await AiConversation.findOne({
    _id: req.params.id,
    organization: req.organization!._id,
    user: req.user!.id,
  });
  if (!conversation) throw new ApiError(404, "Conversation not found");
  ok(res, conversation, "Conversation");
});
