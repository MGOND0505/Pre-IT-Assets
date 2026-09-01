import { ApiError } from "../../utils/ApiError";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || "llama3.1";

export type OllamaToolCall = {
  function: { name: string; arguments: Record<string, unknown> };
};

export type OllamaMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_calls?: OllamaToolCall[];
  tool_name?: string;
};

export type OllamaTool = {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
};

type StreamChunk = { message: { content: string; tool_calls?: OllamaToolCall[] }; done: boolean };

export type OllamaStreamEvent = { contentDelta: string; toolCalls?: OllamaToolCall[]; done: boolean };

// Local CPU inference on an 8B model can genuinely take well over a minute for a single
// response, especially the first call after the model was just loaded into memory - 60s was
// cutting that off mid-generation and (worse) mislabeling the timeout as "not reachable".
const REQUEST_TIMEOUT_MS = 180_000;

function connectionError(err: unknown): ApiError {
  const timedOut = err instanceof Error && err.name === "TimeoutError";
  return new ApiError(
    503,
    timedOut
      ? "AssetIQ AI is taking too long to respond (the local model may still be loading) - please try again in a moment."
      : "AssetIQ AI is not available right now - Ollama isn't reachable."
  );
}

/**
 * Calls the local Ollama server's /api/chat endpoint in streaming mode (newline-delimited JSON,
 * one object per token chunk) and yields one event per line as it arrives. Deliberately never
 * invents a fallback answer - if Ollama isn't running or the model isn't pulled, this throws a
 * real ApiError before yielding anything, the same "never fake a response" convention the rest
 * of this module already follows.
 */
export async function* ollamaChatStream(messages: OllamaMessage[], tools?: OllamaTool[]): AsyncGenerator<OllamaStreamEvent> {
  let res: globalThis.Response;
  try {
    res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, messages, tools, stream: true }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    throw connectionError(err);
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(
      503,
      `AssetIQ AI is not available right now (Ollama returned ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}).`
    );
  }
  if (!res.body) throw new ApiError(503, "AssetIQ AI is not available right now - no response body from Ollama.");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) continue;
        const chunk = JSON.parse(line) as StreamChunk;
        yield { contentDelta: chunk.message?.content ?? "", toolCalls: chunk.message?.tool_calls, done: chunk.done };
      }
    }
  } catch (err) {
    throw connectionError(err);
  }
}
