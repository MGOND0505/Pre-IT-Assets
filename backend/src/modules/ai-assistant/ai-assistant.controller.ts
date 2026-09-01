import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { ApiError } from "../../utils/ApiError";
import { logAction } from "../audit/audit.service";
import { ollamaChatStream, type OllamaMessage, type OllamaToolCall } from "./ollama.client";
import { TOOL_DEFINITIONS, executeTool, applyPendingChange, type ToolContext } from "./ai-tools.service";
import { takePendingChange, discardPendingChange } from "./pending-changes.store";
import * as chatService from "./chat.service";

const SYSTEM_PROMPT = `You are AssetIQ AI, an assistant for a company's IT asset management system.

Rules you must always follow:
- You MUST use the provided tools to look up real data. Never state an asset's, ticket's, or task's status, owner, warranty date, or any other detail from memory or a guess - always call a tool first.
- If a tool returns "ok: false" with a message (e.g. "no match found" or "multiple people match"), relay that honestly to the user and ask them to clarify or try again. Never invent a plausible-sounding answer instead.
- When the user asks you to change something (assign, transfer, return, mark damaged/lost, retire, create), call the matching tool. That tool NEVER applies the change immediately - it only proposes it. After calling it, tell the user you've prepared the change and they need to confirm it in the interface (a Confirm/Cancel control will be shown to them) - do not ask them to type "yes" in the chat, and do not claim the change has been made.
- You can also look up Helpdesk tickets and Tasks, not just assets - use search_tickets/get_ticket_details and search_tasks/get_task_details the same way. There is no write/change tool for tickets or tasks yet - if asked to change one, say that isn't supported yet.
- Keep answers concise and reference real Asset IDs, Ticket IDs, and Task IDs when relevant.`;

type ChatRequestBody = { message: string; sessionId?: string };

function toolContextFor(req: Request): ToolContext {
  return {
    organizationId: req.organization!._id,
    userId: req.user!.id,
    isAdmin: req.user!.isAdmin,
    permissions: req.user!.permissions,
  };
}

export const chat = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as ChatRequestBody;
  const ctx = toolContextFor(req);

  const session = body.sessionId
    ? null
    : await chatService.createSession(ctx.organizationId, ctx.userId, body.message);
  const sessionId = body.sessionId ?? String(session!.id);

  await chatService.appendMessage(sessionId, ctx.organizationId, { role: "user", content: body.message });
  const history = await chatService.getRecentMessages(sessionId, ctx.organizationId);

  const messages: OllamaMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.slice(0, -1).map((m) => ({ role: m.role, content: m.content }) as OllamaMessage),
    { role: "user", content: body.message },
  ];

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let clientDisconnected = false;
  req.on("close", () => {
    clientDisconnected = true;
  });
  function sendEvent(event: Record<string, unknown>) {
    if (clientDisconnected || res.writableEnded) return;
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }

  let pendingChangeForResponse: unknown = null;
  // The model only ever returns to the frontend its own final TEXT summary of a tool's data -
  // for a multi-row search_assets answer, the spec also wants a real table (search/filter/sort/
  // export), so the last successful read tool's raw structured result rides alongside the text,
  // not instead of it.
  let searchResultForResponse: { total: number; page: number; totalPages: number; assets: unknown[] } | null = null;
  let accumulatedContent = "";
  const MAX_TOOL_ROUNDS = 4;

  async function finish(replyContent: string) {
    await chatService.appendMessage(sessionId, ctx.organizationId, {
      role: "assistant",
      content: replyContent,
      pendingChange: pendingChangeForResponse,
      results: searchResultForResponse,
    });
    sendEvent({ type: "done", sessionId, pendingChange: pendingChangeForResponse, results: searchResultForResponse });
    res.end();
  }

  try {
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
      if (clientDisconnected) return;

      let roundContent = "";
      let roundToolCalls: OllamaToolCall[] | undefined;
      for await (const event of ollamaChatStream(messages, TOOL_DEFINITIONS)) {
        if (clientDisconnected) return;
        if (event.contentDelta) {
          roundContent += event.contentDelta;
          accumulatedContent += event.contentDelta;
          sendEvent({ type: "token", delta: event.contentDelta });
        }
        if (event.toolCalls && event.toolCalls.length > 0) roundToolCalls = event.toolCalls;
      }
      messages.push({ role: "assistant", content: roundContent, tool_calls: roundToolCalls });

      if (!roundToolCalls || roundToolCalls.length === 0) {
        return await finish(roundContent);
      }

      for (const call of roundToolCalls) {
        sendEvent({ type: "tool_call", name: call.function.name });
        const result = await executeTool(call.function.name, call.function.arguments, ctx);

        // A write tool's successful result carries a pendingChange - surface it to the frontend
        // as structured data (for the Confirm/Cancel card) separately from the model's own text,
        // and keep what goes back into the model's context free of the raw confirmation token.
        const asProposal = result as { ok?: boolean; pendingChange?: { token: string; assetLabel: string; summary: string; oldValue: unknown; newValue: unknown } };
        const asSearch = result as { ok?: boolean; assets?: unknown[]; total?: number; page?: number; totalPages?: number };

        if (asProposal?.ok && asProposal.pendingChange) {
          const pendingChange = asProposal.pendingChange;
          pendingChangeForResponse = pendingChange;
          messages.push({
            role: "tool",
            tool_name: call.function.name,
            content: JSON.stringify({ ok: true, proposed: pendingChange.summary, asset: pendingChange.assetLabel }),
          });
        } else if (call.function.name === "search_assets" && asSearch?.ok && asSearch.assets) {
          searchResultForResponse = {
            total: asSearch.total ?? asSearch.assets.length,
            page: asSearch.page ?? 1,
            totalPages: asSearch.totalPages ?? 1,
            assets: asSearch.assets,
          };
          // The frontend gets every row (for the real table view above), but the MODEL only needs
          // enough to write an accurate summary - feeding it all 100+ full asset objects just to
          // say "111 laptops are under warranty" was the single biggest cause of slow responses
          // (large local CPU inference is heavily token-bound), with no benefit to the answer.
          const SAMPLE_SIZE = 10;
          messages.push({
            role: "tool",
            tool_name: call.function.name,
            content: JSON.stringify({
              ok: true,
              total: searchResultForResponse.total,
              totalPages: searchResultForResponse.totalPages,
              note:
                searchResultForResponse.total > SAMPLE_SIZE
                  ? `Showing ${SAMPLE_SIZE} of ${searchResultForResponse.total} matching assets as a sample - state the real total (${searchResultForResponse.total}) in your answer, don't imply there are only ${SAMPLE_SIZE}.`
                  : undefined,
              assets: asSearch.assets.slice(0, SAMPLE_SIZE),
            }),
          });
        } else {
          messages.push({ role: "tool", tool_name: call.function.name, content: JSON.stringify(result) });
        }
      }
    }

    const fallbackReply = "I wasn't able to finish looking that up - could you rephrase or narrow your question?";
    sendEvent({ type: "token", delta: fallbackReply });
    await finish(fallbackReply);
  } catch (err) {
    // Headers are already sent once streaming has begun, so an error must be written as an SSE
    // event here rather than thrown to asyncHandler's error middleware.
    const message = err instanceof ApiError ? err.message : "AssetIQ AI is not available right now.";
    sendEvent({ type: "error", message });
    if (!res.writableEnded) res.end();
  }
});

export const confirmChange = asyncHandler(async (req: Request, res: Response) => {
  const ctx = toolContextFor(req);
  const token = req.body?.token as string | undefined;
  if (!token) throw new ApiError(400, "Missing confirmation token");

  const change = takePendingChange(token, ctx.organizationId, ctx.userId);
  if (!change) throw new ApiError(410, "This proposed change has expired or was already handled. Please ask again.");

  const applied = await applyPendingChange(change, ctx);

  await logAction({
    req,
    action: change.action,
    module: "Asset",
    recordId: applied.id,
    recordLabel: applied.assetId,
    oldValue: change.oldValue,
    newValue: change.newValue,
  });
  await chatService.resolvePendingMessage(token, "confirmed");

  ok(res, { assetId: applied.assetId }, "Change applied");
});

export const cancelChange = asyncHandler(async (req: Request, res: Response) => {
  const ctx = toolContextFor(req);
  const token = req.body?.token as string | undefined;
  if (!token) throw new ApiError(400, "Missing confirmation token");

  const change = discardPendingChange(token, ctx.organizationId, ctx.userId);
  if (change) {
    await logAction({
      req,
      action: `${change.action}_CANCELLED`,
      module: "Asset",
      recordId: change.assetId,
      recordLabel: change.assetLabel,
      oldValue: change.oldValue,
      newValue: change.newValue,
    });
  }
  await chatService.resolvePendingMessage(token, "cancelled");
  ok(res, null, "Change cancelled");
});

export const listSessions = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as { scope: "mine" | "all"; userId?: string };
  const sessions = await chatService.listSessions(req.organization!._id, { id: req.user!.id, isAdmin: req.user!.isAdmin }, query);
  ok(res, sessions, "Conversations");
});

export const getSessionMessages = asyncHandler(async (req: Request, res: Response) => {
  const messages = await chatService.getSessionMessages(req.params.id, req.organization!._id, {
    id: req.user!.id,
    isAdmin: req.user!.isAdmin,
  });
  ok(res, messages, "Conversation messages");
});

export const deleteSession = asyncHandler(async (req: Request, res: Response) => {
  await chatService.deleteSession(req.params.id, req.organization!._id, { id: req.user!.id, isAdmin: req.user!.isAdmin });
  ok(res, null, "Conversation deleted");
});
