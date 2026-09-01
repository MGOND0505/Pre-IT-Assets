import { env } from "../../config/env";
import { ApiError } from "../../utils/ApiError";

/** Thin fetch-based client against Ollama's own /api/chat endpoint (NOT the OpenAI-compatible
 * /v1/chat/completions shim) - the native endpoint is what actually supports Ollama's tool-calling
 * contract end to end. Confirmed against Ollama's own docs rather than assumed:
 *  - Request: { model, messages, stream: false, tools }, where `tools` is the same OpenAI-style
 *    array of { type: "function", function: { name, description, parameters } } objects most
 *    tool-calling APIs use.
 *  - Response (non-streaming): { message: { role: "assistant", content, tool_calls? }, done, ... }
 *    where each tool_calls[].function is { name, arguments } - and critically, `arguments` comes
 *    back as an already-parsed JSON OBJECT, not a stringified-JSON string like OpenAI's API. No
 *    parsing step is needed (or correct) here - treat it as Record<string, unknown> directly.
 *  - Ollama's tool-result message role is "tool" with a plain `content` string - there is no
 *    tool_call_id/name correlation field in Ollama's own schema the way OpenAI's has, so a tool
 *    message here is just { role: "tool", content }. */

export type OllamaMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
};

export type OllamaToolDefinition = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

export type OllamaToolCall = {
  name: string;
  arguments: Record<string, unknown>;
};

export type ChatWithToolsResult = {
  content?: string;
  toolCalls?: OllamaToolCall[];
};

type OllamaChatResponse = {
  message?: {
    role?: string;
    content?: string;
    tool_calls?: { function?: { name?: string; arguments?: Record<string, unknown> } }[];
  };
};

/** Calls Ollama's /api/chat once with the given conversation history and tool definitions.
 * Never throws on a "the model just answered in plain text" outcome - only on a genuine
 * transport/service failure (network error, non-2xx status, or an unparseable body), which it
 * turns into a clear ApiError(503, ...) the controller can surface as "AI service unavailable"
 * rather than letting a raw fetch/JSON exception crash the request. */
export async function chatWithTools(
  messages: OllamaMessage[],
  tools: OllamaToolDefinition[]
): Promise<ChatWithToolsResult> {
  let response: Response;
  try {
    response = await fetch(`${env.OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: env.OLLAMA_MODEL,
        messages,
        stream: false,
        ...(tools.length > 0 ? { tools } : {}),
      }),
    });
  } catch {
    throw new ApiError(503, "AI service unavailable - could not reach the local Ollama server");
  }

  if (!response.ok) {
    throw new ApiError(503, `AI service unavailable - Ollama responded with status ${response.status}`);
  }

  let body: OllamaChatResponse;
  try {
    body = (await response.json()) as OllamaChatResponse;
  } catch {
    throw new ApiError(503, "AI service unavailable - could not parse the Ollama response");
  }

  const toolCalls = body.message?.tool_calls
    ?.filter((call) => call.function?.name)
    .map((call) => ({
      name: call.function!.name as string,
      arguments: call.function!.arguments ?? {},
    }));

  return {
    content: body.message?.content || undefined,
    toolCalls: toolCalls && toolCalls.length > 0 ? toolCalls : undefined,
  };
}
