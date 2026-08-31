import type { Request, Response } from "express";
import { asyncHandler } from "../../utils/asyncHandler";
import { ok } from "../../utils/response";
import { ApiError } from "../../utils/ApiError";
import { logAction } from "../audit/audit.service";
import { ollamaChat, type OllamaMessage } from "./ollama.client";
import { TOOL_DEFINITIONS, executeTool, applyPendingChange, type ToolContext } from "./ai-tools.service";
import { takePendingChange, discardPendingChange } from "./pending-changes.store";

const SYSTEM_PROMPT = `You are AssetIQ AI, an assistant for a company's IT asset management system.

Rules you must always follow:
- You MUST use the provided tools to look up real data. Never state an asset's status, owner, warranty date, or any other detail from memory or a guess - always call a tool first.
- If a tool returns "ok: false" with a message (e.g. "no match found" or "multiple people match"), relay that honestly to the user and ask them to clarify or try again. Never invent a plausible-sounding answer instead.
- When the user asks you to change something (assign, transfer, return, mark damaged/lost, retire, create), call the matching tool. That tool NEVER applies the change immediately - it only proposes it. After calling it, tell the user you've prepared the change and they need to confirm it in the interface (a Confirm/Cancel control will be shown to them) - do not ask them to type "yes" in the chat, and do not claim the change has been made.
- Keep answers concise and reference real Asset IDs when relevant.`;

type ChatRequestBody = { message: string; history?: { role: "user" | "assistant"; content: string }[] };

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

  const messages: OllamaMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    ...(body.history ?? []).map((m) => ({ role: m.role, content: m.content }) as OllamaMessage),
    { role: "user", content: body.message },
  ];

  let pendingChangeForResponse: unknown = null;
  // The model only ever returns to the frontend its own final TEXT summary of a tool's data -
  // for a multi-row search_assets answer, the spec also wants a real table (search/filter/sort/
  // export), so the last successful read tool's raw structured result rides alongside the text,
  // not instead of it.
  let searchResultForResponse: { total: number; page: number; totalPages: number; assets: unknown[] } | null = null;
  const MAX_TOOL_ROUNDS = 4;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const reply = await ollamaChat(messages, TOOL_DEFINITIONS);
    messages.push(reply);

    if (!reply.tool_calls || reply.tool_calls.length === 0) {
      return ok(
        res,
        { reply: reply.content, pendingChange: pendingChangeForResponse, results: searchResultForResponse },
        "AssetIQ AI response"
      );
    }

    for (const call of reply.tool_calls) {
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

  return ok(
    res,
    {
      reply: "I wasn't able to finish looking that up - could you rephrase or narrow your question?",
      pendingChange: pendingChangeForResponse,
      results: searchResultForResponse,
    },
    "AssetIQ AI response"
  );
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

  ok(res, { assetId: applied.assetId }, "Change applied");
});

export const cancelChange = asyncHandler(async (req: Request, res: Response) => {
  const ctx = toolContextFor(req);
  const token = req.body?.token as string | undefined;
  if (!token) throw new ApiError(400, "Missing confirmation token");

  discardPendingChange(token, ctx.organizationId, ctx.userId);
  ok(res, null, "Change cancelled");
});
