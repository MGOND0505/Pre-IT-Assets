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

type ChatResponse = { message: OllamaMessage; done: boolean };

/**
 * Calls the local Ollama server's /api/chat endpoint (tool-calling, non-streaming). Deliberately
 * never invents a fallback answer - if Ollama isn't running or the model isn't pulled, this
 * throws a real ApiError that the controller turns into an honest "AI assistant is not available
 * right now" reply, the same "never fake a response" convention the existing AiAssistant search
 * widget already follows for its own "not connected to a conversational AI backend" case.
 */
// Local CPU inference on an 8B model can genuinely take well over a minute for a single
// response, especially the first call after the model was just loaded into memory - 60s was
// cutting that off mid-generation and (worse) mislabeling the timeout as "not reachable".
const REQUEST_TIMEOUT_MS = 180_000;

export async function ollamaChat(messages: OllamaMessage[], tools?: OllamaTool[]): Promise<OllamaMessage> {
  let res: globalThis.Response;
  try {
    res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: OLLAMA_MODEL, messages, tools, stream: false }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch (err) {
    const timedOut = err instanceof Error && err.name === "TimeoutError";
    throw new ApiError(
      503,
      timedOut
        ? "AssetIQ AI is taking too long to respond (the local model may still be loading) - please try again in a moment."
        : "AssetIQ AI is not available right now - Ollama isn't reachable."
    );
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(
      503,
      `AssetIQ AI is not available right now (Ollama returned ${res.status}${text ? `: ${text.slice(0, 200)}` : ""}).`
    );
  }

  const data = (await res.json()) as ChatResponse;
  return data.message;
}
